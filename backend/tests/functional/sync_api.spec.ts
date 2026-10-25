import { randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

test.group('Offline sync API', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('accepts a category once and includes it in the change feed', async ({ client }) => {
    const bootstrap = await client.post('/api/v1/bootstrap').json({
      openingSpendableCents: 0,
      openingSavingsCents: 0,
      reminderTime: '09:00',
    })
    const paired = await client.post('/api/v1/pair').json({
      pairingCode: bootstrap.body().data.pairingCode,
      label: 'Phone one',
    })
    const auth = `Bearer ${paired.body().data.credential}`
    const entityId = randomUUID()
    const operation = {
      operationId: randomUUID(),
      entityType: 'category',
      entityId,
      action: 'create',
      baseRevision: 0,
      value: { name: 'Food' },
    }

    const first = await client
      .post('/api/v1/sync/push')
      .header('Authorization', auth)
      .json({
        operations: [operation],
      })
    first.assertStatus(200)
    first.assertBodyContains({
      data: { outcomes: [{ operationId: operation.operationId, status: 'accepted', revision: 1 }] },
    })

    const repeated = await client
      .post('/api/v1/sync/push')
      .header('Authorization', auth)
      .json({
        operations: [operation],
      })
    repeated.assertStatus(200)
    repeated.assertBodyContains({
      data: {
        outcomes: [{ operationId: operation.operationId, status: 'duplicate', revision: 1 }],
      },
    })

    const changes = await client.get('/api/v1/sync/changes?cursor=0').header('Authorization', auth)
    changes.assertStatus(200)
    changes.assertBodyContains({
      data: {
        changes: [{ entityType: 'category', entityId, revision: 1, value: { name: 'Food' } }],
      },
    })

    const revoked = await client
      .delete(`/api/v1/devices/${paired.body().data.deviceId}`)
      .header('Authorization', auth)
    revoked.assertStatus(204)
    const queued = await client
      .post('/api/v1/sync/push')
      .header('Authorization', auth)
      .json({
        operations: [
          {
            ...operation,
            operationId: randomUUID(),
            action: 'update',
            baseRevision: 1,
            value: { name: 'Meals' },
          },
        ],
      })
    queued.assertStatus(401)
  })

  test('keeps both versions for a stale offline edit and publishes deletion tombstones', async ({
    client,
  }) => {
    const bootstrap = await client.post('/api/v1/bootstrap').json({
      openingSpendableCents: 0,
      openingSavingsCents: 0,
      reminderTime: '09:00',
    })
    const first = await client
      .post('/api/v1/pair')
      .json({ pairingCode: bootstrap.body().data.pairingCode, label: 'One' })
    const firstAuth = `Bearer ${first.body().data.credential}`
    const code = await client.post('/api/v1/pairing-codes').header('Authorization', firstAuth)
    const second = await client
      .post('/api/v1/pair')
      .json({ pairingCode: code.body().data.pairingCode, label: 'Two' })
    const secondAuth = `Bearer ${second.body().data.credential}`
    const entityId = randomUUID()
    const send = (auth: string, action: string, baseRevision: number, value?: object) =>
      client
        .post('/api/v1/sync/push')
        .header('Authorization', auth)
        .json({
          operations: [
            {
              operationId: randomUUID(),
              entityType: 'category',
              entityId,
              action,
              baseRevision,
              value,
            },
          ],
        })

    const created = await send(firstAuth, 'create', 0, { name: 'Food' })
    created.assertBodyContains({ data: { outcomes: [{ status: 'accepted', revision: 1 }] } })
    const updated = await send(secondAuth, 'update', 1, { name: 'Groceries' })
    updated.assertBodyContains({ data: { outcomes: [{ status: 'accepted', revision: 2 }] } })
    const stale = await send(firstAuth, 'update', 1, { name: 'Meals' })
    stale.assertBodyContains({
      data: { outcomes: [{ status: 'conflict', proposedValue: { value: { name: 'Meals' } } }] },
    })

    const resolved = await client.get(`/api/v1/sync/conflicts`).header('Authorization', secondAuth)
    resolved.assertStatus(200)
    resolved.assertBodyContains({
      data: { conflicts: [{ entityId, proposedValue: { value: { name: 'Meals' } } }] },
    })

    const conflictId = resolved.body().data.conflicts[0].id
    const selected = await client
      .post(`/api/v1/sync/conflicts/${conflictId}/resolve`)
      .header('Authorization', secondAuth)
      .json({ choice: 'proposed' })
    selected.assertStatus(200)
    const category = await client.get('/api/v1/categories').header('Authorization', firstAuth)
    category.assertBodyContains({ data: [{ id: entityId, name: 'Meals', revision: 3 }] })
    const afterResolution = await client
      .get('/api/v1/sync/conflicts')
      .header('Authorization', firstAuth)
    afterResolution.assertBodyContains({ data: { conflicts: [] } })

    const deleted = await send(secondAuth, 'delete', 3)
    deleted.assertBodyContains({ data: { outcomes: [{ status: 'accepted', revision: 4 }] } })
    const changes = await client
      .get('/api/v1/sync/changes?cursor=0')
      .header('Authorization', firstAuth)
    changes.assertBodyContains({
      data: { changes: [{ entityType: 'category', entityId, deleted: true }] },
    })
  })

  test('publishes recurring rules and generated occurrences to a paired phone', async ({
    client,
  }) => {
    const bootstrap = await client.post('/api/v1/bootstrap').json({
      openingSpendableCents: 0,
      openingSavingsCents: 0,
      reminderTime: '09:00',
    })
    const paired = await client
      .post('/api/v1/pair')
      .json({ pairingCode: bootstrap.body().data.pairingCode, label: 'Phone' })
    const auth = `Bearer ${paired.body().data.credential}`
    const rule = await client.post('/api/v1/recurring-rules').header('Authorization', auth).json({
      kind: 'bill',
      name: 'Rent',
      categoryId: null,
      amountCents: 100000,
      frequency: 'monthly',
      interval: 1,
      startsOn: '2026-10-01',
      endsOn: null,
    })
    rule.assertStatus(201)
    const afterRule = await client
      .get('/api/v1/sync/changes?cursor=0')
      .header('Authorization', auth)
    afterRule.assertBodyContains({
      data: { changes: [{ entityType: 'recurring_rule', entityId: rule.body().data.id }] },
    })

    const occurrences = await client
      .get('/api/v1/occurrences?from=2026-10-01&through=2026-10-31&today=2026-10-01')
      .header('Authorization', auth)
    occurrences.assertStatus(200)
    const afterGeneration = await client
      .get('/api/v1/sync/changes?cursor=0')
      .header('Authorization', auth)
    afterGeneration.assertBodyContains({
      data: { changes: [{ entityType: 'occurrence', entityId: occurrences.body().data[0].id }] },
    })
  })

  test('accepts an offline recurring rule with a stable phone-generated ID', async ({ client }) => {
    const bootstrap = await client.post('/api/v1/bootstrap').json({
      openingSpendableCents: 0,
      openingSavingsCents: 0,
      reminderTime: '09:00',
    })
    const paired = await client
      .post('/api/v1/pair')
      .json({ pairingCode: bootstrap.body().data.pairingCode, label: 'Phone' })
    const auth = `Bearer ${paired.body().data.credential}`
    const entityId = randomUUID()
    const pushed = await client
      .post('/api/v1/sync/push')
      .header('Authorization', auth)
      .json({
        operations: [
          {
            operationId: randomUUID(),
            entityType: 'recurring_rule',
            entityId,
            action: 'create',
            baseRevision: 0,
            value: {
              kind: 'income',
              name: 'Pay',
              categoryId: null,
              amountCents: 150000,
              frequency: 'weekly',
              interval: 2,
              startsOn: '2026-10-05',
              endsOn: null,
            },
          },
        ],
      })
    pushed.assertBodyContains({ data: { outcomes: [{ status: 'accepted', revision: 1 }] } })
    const changes = await client.get('/api/v1/sync/changes?cursor=0').header('Authorization', auth)
    changes.assertBodyContains({
      data: { changes: [{ entityType: 'recurring_rule', entityId, value: { name: 'Pay' } }] },
    })

    const firstUpdate = await client
      .post('/api/v1/sync/push')
      .header('Authorization', auth)
      .json({
        operations: [
          {
            operationId: randomUUID(),
            entityType: 'recurring_rule',
            entityId,
            action: 'update',
            baseRevision: 1,
            value: { name: 'Paycheck' },
          },
        ],
      })
    firstUpdate.assertBodyContains({ data: { outcomes: [{ status: 'accepted', revision: 2 }] } })
    const stale = await client
      .post('/api/v1/sync/push')
      .header('Authorization', auth)
      .json({
        operations: [
          {
            operationId: randomUUID(),
            entityType: 'recurring_rule',
            entityId,
            action: 'update',
            baseRevision: 1,
            value: { name: 'Wages' },
          },
        ],
      })
    stale.assertBodyContains({ data: { outcomes: [{ status: 'conflict' }] } })
    const conflicts = await client.get('/api/v1/sync/conflicts').header('Authorization', auth)
    const selected = await client
      .post(`/api/v1/sync/conflicts/${conflicts.body().data.conflicts[0].id}/resolve`)
      .header('Authorization', auth)
      .json({ choice: 'proposed' })
    selected.assertStatus(200)
    const afterResolution = await client
      .get('/api/v1/sync/changes?cursor=0')
      .header('Authorization', auth)
    afterResolution.assertBodyContains({
      data: {
        changes: [
          { entityType: 'recurring_rule', entityId, revision: 3, value: { name: 'Wages' } },
        ],
      },
    })
  })

  test('syncs an offline confirmation into the ledger once', async ({ client }) => {
    const bootstrap = await client.post('/api/v1/bootstrap').json({
      openingSpendableCents: 100000,
      openingSavingsCents: 0,
      reminderTime: '09:00',
    })
    const paired = await client
      .post('/api/v1/pair')
      .json({ pairingCode: bootstrap.body().data.pairingCode, label: 'Phone' })
    const auth = `Bearer ${paired.body().data.credential}`
    await client.post('/api/v1/recurring-rules').header('Authorization', auth).json({
      kind: 'bill',
      name: 'Rent',
      categoryId: null,
      amountCents: 20000,
      frequency: 'monthly',
      interval: 1,
      startsOn: '2026-10-01',
      endsOn: null,
    })
    const occurrences = await client
      .get('/api/v1/occurrences?from=2026-10-01&through=2026-10-31&today=2026-10-01')
      .header('Authorization', auth)
    const occurrenceId = occurrences.body().data[0].id
    const operation = {
      operationId: randomUUID(),
      entityType: 'occurrence',
      entityId: occurrenceId,
      action: 'update',
      baseRevision: 1,
      value: { actualDate: '2026-10-02', actualAmountCents: 20500 },
    }
    const first = await client
      .post('/api/v1/sync/push')
      .header('Authorization', auth)
      .json({ operations: [operation] })
    first.assertBodyContains({ data: { outcomes: [{ status: 'accepted', revision: 2 }] } })
    const again = await client
      .post('/api/v1/sync/push')
      .header('Authorization', auth)
      .json({ operations: [operation] })
    again.assertBodyContains({ data: { outcomes: [{ status: 'duplicate', revision: 2 }] } })
    const balance = await client
      .get('/api/v1/balances?asOf=2026-10-02')
      .header('Authorization', auth)
    balance.assertBodyContains({ data: { spendableCents: 79500 } })
  })

  test('syncs a monthly estimate and keeps a stale offline edit for review', async ({ client }) => {
    const bootstrap = await client
      .post('/api/v1/bootstrap')
      .json({ openingSpendableCents: 0, openingSavingsCents: 0, reminderTime: '09:00' })
    const paired = await client
      .post('/api/v1/pair')
      .json({ pairingCode: bootstrap.body().data.pairingCode, label: 'Phone' })
    const auth = `Bearer ${paired.body().data.credential}`
    const category = await client
      .post('/api/v1/categories')
      .header('Authorization', auth)
      .json({ name: 'Food' })
    const entityId = randomUUID()
    const send = (action: string, baseRevision: number, amountCents: number) =>
      client
        .post('/api/v1/sync/push')
        .header('Authorization', auth)
        .json({
          operations: [
            {
              operationId: randomUUID(),
              entityType: 'monthly_estimate',
              entityId,
              action,
              baseRevision,
              value: { categoryId: category.body().data.id, month: '2026-10', amountCents },
            },
          ],
        })
    const created = await send('create', 0, 40000)
    created.assertBodyContains({ data: { outcomes: [{ status: 'accepted', revision: 1 }] } })
    const updated = await send('update', 1, 45000)
    updated.assertBodyContains({ data: { outcomes: [{ status: 'accepted', revision: 2 }] } })
    const stale = await send('update', 1, 42000)
    stale.assertBodyContains({ data: { outcomes: [{ status: 'conflict' }] } })
    const conflicts = await client.get('/api/v1/sync/conflicts').header('Authorization', auth)
    const resolved = await client
      .post(`/api/v1/sync/conflicts/${conflicts.body().data.conflicts[0].id}/resolve`)
      .header('Authorization', auth)
      .json({ choice: 'proposed' })
    resolved.assertStatus(200)
    const changes = await client.get('/api/v1/sync/changes?cursor=0').header('Authorization', auth)
    changes.assertBodyContains({
      data: {
        changes: [
          { entityType: 'monthly_estimate', entityId, revision: 3, value: { amountCents: 42000 } },
        ],
      },
    })
  })

  test('syncs a monthly savings target to the change feed', async ({ client }) => {
    const bootstrap = await client
      .post('/api/v1/bootstrap')
      .json({ openingSpendableCents: 0, openingSavingsCents: 0, reminderTime: '09:00' })
    const paired = await client
      .post('/api/v1/pair')
      .json({ pairingCode: bootstrap.body().data.pairingCode, label: 'Phone' })
    const auth = `Bearer ${paired.body().data.credential}`
    const entityId = randomUUID()
    const pushed = await client
      .post('/api/v1/sync/push')
      .header('Authorization', auth)
      .json({
        operations: [
          {
            operationId: randomUUID(),
            entityType: 'monthly_plan',
            entityId,
            action: 'create',
            baseRevision: 0,
            value: { month: '2026-10', savingsTargetCents: 10000 },
          },
        ],
      })
    pushed.assertBodyContains({ data: { outcomes: [{ status: 'accepted', revision: 1 }] } })
    const changes = await client.get('/api/v1/sync/changes?cursor=0').header('Authorization', auth)
    changes.assertBodyContains({
      data: {
        changes: [
          {
            entityType: 'monthly_plan',
            entityId,
            value: { month: '2026-10', savingsTargetCents: 10000 },
          },
        ],
      },
    })
  })
})
