import { randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'

async function pair(client: any) {
  const setup = await client
    .post('/api/v1/bootstrap')
    .json({ openingSpendableCents: 100000, openingSavingsCents: 0, reminderTime: '09:00' })
  const setupData = setup.body().data
  const paired = await client
    .post('/api/v1/pair')
    .json({ pairingCode: setupData.pairingCode, label: 'Sync phone' })
  const device = paired.body().data
  return `Bearer ${device.credential}`
}

test.group('Sync HTTP contract', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('rejects an invalid cursor with a field validation error', async ({ client }) => {
    const auth = await pair(client)
    const result = await client
      .get('/api/v1/sync/changes?cursor=bogus')
      .header('Authorization', auth)
    result.assertStatus(422)
    result.assertBodyContains({ code: 'VALIDATION_ERROR', details: [{ field: 'cursor' }] })
  })

  test('returns a state conflict for an existing category name', async ({ client }) => {
    const auth = await pair(client)
    await client.post('/api/v1/categories').header('Authorization', auth).json({ name: 'Food' })
    const duplicate = await client
      .post('/api/v1/categories')
      .header('Authorization', auth)
      .json({ name: 'Food' })
    duplicate.assertStatus(409)
    duplicate.assertBodyContains({ code: 'DUPLICATE_RESOURCE' })
  })

  test('syncs an offline reminder change and publishes the household settings', async ({
    client,
  }) => {
    const auth = await pair(client)
    const household = await client.get('/api/v1/household').header('Authorization', auth)
    const entityId = household.body().data.id
    const pushed = await client
      .post('/api/v1/sync/push')
      .header('Authorization', auth)
      .json({
        operations: [
          {
            operationId: randomUUID(),
            entityId,
            entityType: 'household',
            action: 'update',
            baseRevision: 1,
            value: { reminderTime: '08:30' },
          },
        ],
      })
    pushed.assertBodyContains({ data: { outcomes: [{ status: 'accepted', revision: 2 }] } })
    const feed = await client.get('/api/v1/sync/changes?cursor=0').header('Authorization', auth)
    feed.assertBodyContains({
      data: {
        changes: [
          {
            entityType: 'household',
            entityId,
            revision: 2,
            value: { reminderTime: '08:30', timeZone: 'America/Toronto' },
          },
        ],
      },
    })
  })

  test('rejects a malformed operation without dropping a valid edit in the same batch', async ({
    client,
  }) => {
    const auth = await pair(client)
    const entityId = randomUUID()
    const result = await client
      .post('/api/v1/sync/push')
      .header('Authorization', auth)
      .json({
        operations: [
          null,
          {
            operationId: randomUUID(),
            entityId,
            entityType: 'category',
            action: 'create',
            baseRevision: 0,
            value: { name: 'Food' },
          },
        ],
      })
    result.assertStatus(200)
    result.assertBodyContains({
      data: {
        outcomes: [
          { operationId: null, status: 'rejected', code: 'VALIDATION_ERROR' },
          { status: 'accepted', revision: 1 },
        ],
      },
    })
  })

  test('rolls back the chosen edit if closing its conflict fails', async ({ client }) => {
    const auth = await pair(client)
    const entityId = randomUUID()
    const send = (action: string, baseRevision: number, name: string) =>
      client
        .post('/api/v1/sync/push')
        .header('Authorization', auth)
        .json({
          operations: [
            {
              operationId: randomUUID(),
              entityId,
              entityType: 'category',
              action,
              baseRevision,
              value: { name },
            },
          ],
        })
    await send('create', 0, 'Food')
    await send('update', 1, 'Groceries')
    const stale = await send('update', 1, 'Meals')
    const conflictId = stale.body().data.outcomes[0].conflictId
    await db.rawQuery(
      "CREATE TRIGGER fail_conflict_close BEFORE UPDATE ON sync_conflicts BEGIN SELECT RAISE(ABORT, 'simulated storage failure'); END"
    )
    try {
      const result = await client
        .post(`/api/v1/sync/conflicts/${conflictId}/resolve`)
        .header('Authorization', auth)
        .json({ choice: 'proposed' })
      result.assertStatus(500)
      result.assertBodyContains({ code: 'INTERNAL_SERVER_ERROR' })
      const categories = await client.get('/api/v1/categories').header('Authorization', auth)
      categories.assertBodyContains({ data: [{ id: entityId, name: 'Groceries', revision: 2 }] })
      const conflicts = await client.get('/api/v1/sync/conflicts').header('Authorization', auth)
      conflicts.assertBodyContains({ data: { conflicts: [{ id: conflictId }] } })
    } finally {
      await db.rawQuery('DROP TRIGGER IF EXISTS fail_conflict_close')
    }
  })

  test('resolves a stale delete while preserving its tombstone', async ({ client }) => {
    const auth = await pair(client)
    const entityId = randomUUID()
    const send = (action: string, baseRevision: number, value?: object) =>
      client
        .post('/api/v1/sync/push')
        .header('Authorization', auth)
        .json({
          operations: [
            {
              operationId: randomUUID(),
              entityId,
              entityType: 'category',
              action,
              baseRevision,
              value,
            },
          ],
        })
    await send('create', 0, { name: 'Food' })
    await send('update', 1, { name: 'Groceries' })
    const stale = await send('delete', 1)
    const conflictId = stale.body().data.outcomes[0].conflictId
    const result = await client
      .post(`/api/v1/sync/conflicts/${conflictId}/resolve`)
      .header('Authorization', auth)
      .json({ choice: 'proposed' })
    result.assertStatus(200)
    const feed = await client.get('/api/v1/sync/changes?cursor=0').header('Authorization', auth)
    feed.assertBodyContains({
      data: {
        changes: [{ entityType: 'category', entityId, deleted: true, revision: 3, value: null }],
      },
    })
  })

  for (const entityType of ['ledger_entry', 'monthly_plan', 'household', 'occurrence'] as const) {
    test(`reviews and applies a conflicting ${entityType} edit`, async ({ client, assert }) => {
      const auth = await pair(client)
      let entityId = randomUUID()
      let initial: object = { kind: 'expense', entryDate: '2026-10-04', amountCents: 1000 }
      let server: object = { amountCents: 1200 }
      let proposed: object = { amountCents: 900 }
      if (entityType === 'monthly_plan') {
        initial = { month: '2026-10', savingsTargetCents: 10000 }
        server = { month: '2026-10', savingsTargetCents: 12000 }
        proposed = { month: '2026-10', savingsTargetCents: 9000 }
      } else if (entityType === 'household') {
        const household = await client.get('/api/v1/household').header('Authorization', auth)
        entityId = household.body().data.id
        server = { reminderTime: '08:30' }
        proposed = { reminderTime: '07:00' }
      } else if (entityType === 'occurrence') {
        await client.post('/api/v1/recurring-rules').header('Authorization', auth).json({
          kind: 'bill',
          name: 'Internet',
          amountCents: 1000,
          frequency: 'monthly',
          interval: 1,
          startsOn: '2026-10-04',
        })
        const occurrences = await client
          .get('/api/v1/occurrences?from=2026-10-04&through=2026-10-04&today=2026-10-04')
          .header('Authorization', auth)
        entityId = occurrences.body().data[0].id
        server = { actualDate: '2026-10-04', actualAmountCents: 1200 }
        proposed = { actualDate: '2026-10-04', actualAmountCents: 900 }
      }
      const send = (action: string, baseRevision: number, value: object) =>
        client
          .post('/api/v1/sync/push')
          .header('Authorization', auth)
          .json({
            operations: [
              { operationId: randomUUID(), entityId, entityType, action, baseRevision, value },
            ],
          })
      if (entityType === 'ledger_entry' || entityType === 'monthly_plan') {
        const created = await send('create', 0, initial)
        created.assertBodyContains({ data: { outcomes: [{ status: 'accepted', revision: 1 }] } })
      }
      const updated = await send('update', 1, server)
      updated.assertBodyContains({ data: { outcomes: [{ status: 'accepted', revision: 2 }] } })
      const stale = await send('update', 1, proposed)
      stale.assertBodyContains({
        data: { outcomes: [{ status: 'conflict', serverValue: { id: entityId, revision: 2 } }] },
      })
      assert.notProperty(stale.body().data.outcomes[0].serverValue, 'household_id')
      const conflictId = stale.body().data.outcomes[0].conflictId
      const resolved = await client
        .post(`/api/v1/sync/conflicts/${conflictId}/resolve`)
        .header('Authorization', auth)
        .json({ choice: 'proposed' })
      resolved.assertStatus(200)
      const feed = await client.get('/api/v1/sync/changes?cursor=0').header('Authorization', auth)
      feed.assertBodyContains({
        data: { changes: [{ entityType, entityId, revision: 3, value: proposed }] },
      })
      if (entityType === 'ledger_entry' || entityType === 'occurrence') {
        const balance = await client
          .get('/api/v1/balances?asOf=2026-10-04')
          .header('Authorization', auth)
        balance.assertBodyContains({ data: { spendableCents: 99100 } })
      }
    })
  }
})

test.group('sync recovery HTTP', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  test('storage failure leaves earlier accepted operations safe to retry', async ({
    client,
    assert,
  }) => {
    const auth = await pair(client)
    const operations = ['Accepted', 'Retry'].map((name) => ({
      operationId: randomUUID(),
      entityId: randomUUID(),
      entityType: 'category',
      action: 'create',
      baseRevision: 0,
      value: { name },
    }))
    await db.rawQuery(
      "CREATE TRIGGER fail_retry BEFORE INSERT ON categories WHEN NEW.name = 'Retry' BEGIN SELECT RAISE(ABORT, 'temporary storage failure'); END"
    )
    try {
      const failed = await client
        .post('/api/v1/sync/push')
        .header('Authorization', auth)
        .json({ operations })
      failed.assertStatus(500)
      assert.lengthOf(await db.from('sync_receipts'), 1)
    } finally {
      await db.rawQuery('DROP TRIGGER fail_retry')
    }
    const retry = await client
      .post('/api/v1/sync/push')
      .header('Authorization', auth)
      .json({ operations })
    retry.assertStatus(200)
    assert.deepEqual(
      retry.body().data.outcomes.map((o: any) => o.status),
      ['duplicate', 'accepted']
    )
    assert.lengthOf(await db.from('categories'), 2)
  })

  test('a restored history rejects pushes from the previous generation', async ({
    client,
    assert,
  }) => {
    const auth = await pair(client)
    const feed = await client.get('/api/v1/sync/changes?cursor=500').header('Authorization', auth)
    const generation = feed.body().data.generation
    assert.match(generation, /^[0-9a-f-]{36}$/)
    await db.from('households').update({ sync_generation: randomUUID() })
    const rejected = await client
      .post('/api/v1/sync/push')
      .header('Authorization', auth)
      .json({
        generation,
        operations: [
          {
            operationId: randomUUID(),
            entityId: randomUUID(),
            entityType: 'category',
            action: 'create',
            baseRevision: 0,
            value: { name: 'Unsafe' },
          },
        ],
      })
    rejected.assertStatus(409)
    rejected.assertBodyContains({ code: 'SYNC_RESET' })
    assert.lengthOf(await db.from('categories'), 0)
    const restored = await client.get('/api/v1/sync/changes?cursor=0').header('Authorization', auth)
    assert.notEqual(restored.body().data.generation, generation)
    assert.isAbove(restored.body().data.changes.length, 0)
  })
})
