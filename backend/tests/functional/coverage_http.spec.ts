import { randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import type { ApiClient } from '@japa/api-client'

async function pair(client: ApiClient) {
  const bootstrap = await client.post('/api/v1/bootstrap').json({
    openingSpendableCents: 100000,
    openingSavingsCents: 20000,
    reminderTime: '09:00',
  })
  bootstrap.assertStatus(201)
  const response = await client.post('/api/v1/pair').json({
    pairingCode: bootstrap.body().data.pairingCode,
    label: 'Coverage phone',
  })
  response.assertStatus(201)
  return `Bearer ${response.body().data.credential}`
}

test.group('household HTTP lifecycle and reports', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('category edits require current revisions and deletion hides the category', async ({
    client,
  }) => {
    const auth = await pair(client)
    const created = await client
      .post('/api/v1/categories')
      .header('Authorization', auth)
      .json({ name: 'Food' })
    created.assertStatus(201)
    const id = created.body().data.id
    const updated = await client
      .patch(`/api/v1/categories/${id}`)
      .header('Authorization', auth)
      .json({ name: 'Groceries', active: false, revision: 1 })
    updated.assertStatus(200)
    updated.assertBodyContains({ data: { id, name: 'Groceries', active: false, revision: 2 } })
    const staleEdit = await client
      .patch(`/api/v1/categories/${id}`)
      .header('Authorization', auth)
      .json({ name: 'Wrong', revision: 1 })
    staleEdit.assertStatus(409)
    const staleDelete = await client
      .delete(`/api/v1/categories/${id}`)
      .header('Authorization', auth)
      .json({ revision: 1 })
    staleDelete.assertStatus(409)
    const deleted = await client
      .delete(`/api/v1/categories/${id}`)
      .header('Authorization', auth)
      .json({ revision: 2 })
    deleted.assertStatus(204)
    const list = await client.get('/api/v1/categories').header('Authorization', auth)
    list.assertBody({ data: [] })
    const missing = await client
      .patch(`/api/v1/categories/${id}`)
      .header('Authorization', auth)
      .json({ name: 'Restored', revision: 3 })
    missing.assertStatus(404)
  })
  test('deleting an expense restores balances, removes reports, and leaves a sync tombstone', async ({
    client,
    assert,
  }) => {
    const auth = await pair(client)
    const created = await client
      .post('/api/v1/entries')
      .header('Authorization', auth)
      .json({ kind: 'expense', entryDate: '2026-06-10', amountCents: 2500, note: 'Dinner' })
    created.assertStatus(201)
    const id = created.body().data.id
    const list = await client.get('/api/v1/entries?month=2026-06').header('Authorization', auth)
    list.assertBodyContains({ data: [{ id, amountCents: 2500 }] })
    const otherMonth = await client
      .get('/api/v1/entries?month=2026-07')
      .header('Authorization', auth)
    otherMonth.assertBody({ data: [] })
    const actuals = await client
      .get('/api/v1/months/2026-06/actuals?today=2026-06-10')
      .header('Authorization', auth)
    actuals.assertStatus(200)
    actuals.assertBody({
      data: {
        incomeCents: 0,
        spendingCents: 2500,
        transferToSavingsCents: 0,
        moneyLeftTodayCents: 97500,
      },
    })
    const stale = await client
      .delete(`/api/v1/entries/${id}`)
      .header('Authorization', auth)
      .json({ revision: 2 })
    stale.assertStatus(409)
    const invalid = await client
      .delete(`/api/v1/entries/${id}`)
      .header('Authorization', auth)
      .json({})
    invalid.assertStatus(422)
    const removed = await client
      .delete(`/api/v1/entries/${id}`)
      .header('Authorization', auth)
      .json({ revision: 1 })
    removed.assertStatus(204)
    const all = await client.get('/api/v1/entries').header('Authorization', auth)
    all.assertBody({ data: [] })
    const missingHistory = await client
      .get(`/api/v1/entries/${id}/history`)
      .header('Authorization', auth)
    missingHistory.assertStatus(404)
    const missingDelete = await client
      .delete(`/api/v1/entries/${id}`)
      .header('Authorization', auth)
      .json({ revision: 2 })
    missingDelete.assertStatus(404)
    const restored = await client
      .get('/api/v1/balances?asOf=2026-06-10')
      .header('Authorization', auth)
    restored.assertBodyContains({
      data: { spendableCents: 100000, savingsCents: 20000, combinedCents: 120000 },
    })
    const changes = await client.get('/api/v1/sync/changes').header('Authorization', auth)
    changes.assertStatus(200)
    assert.isTrue(
      changes
        .body()
        .data.changes.some((change: any) => change.entityId === id && change.deletedAt !== null)
    )
  })

  test('suggestions use observed months while actuals exclude future entries and keep savings separate', async ({
    client,
  }) => {
    const auth = await pair(client)
    const category = await client
      .post('/api/v1/categories')
      .header('Authorization', auth)
      .json({ name: 'Food' })
    category.assertStatus(201)
    const categoryId = category.body().data.id
    const empty = await client
      .get(`/api/v1/months/2026-06/suggestions/${categoryId}`)
      .header('Authorization', auth)
    empty.assertBody({ data: { categoryId, month: '2026-06', amountCents: null, sampleCount: 0 } })
    for (const [entryDate, amountCents] of [
      ['2026-01-10', 1000],
      ['2026-02-10', 3000],
    ] as const) {
      const response = await client
        .post('/api/v1/entries')
        .header('Authorization', auth)
        .json({ kind: 'expense', entryDate, amountCents, categoryId })
      response.assertStatus(201)
    }
    const suggested = await client
      .get(`/api/v1/months/2026-06/suggestions/${categoryId}`)
      .header('Authorization', auth)
    suggested.assertBody({
      data: { categoryId, month: '2026-06', amountCents: 2000, sampleCount: 2 },
    })
    for (const entry of [
      { kind: 'income', entryDate: '2026-06-01', amountCents: 10000 },
      { kind: 'expense', entryDate: '2026-06-02', amountCents: 2000, categoryId },
      { kind: 'savings_transfer', entryDate: '2026-06-03', amountCents: 5000 },
      {
        kind: 'balance_adjustment',
        entryDate: '2026-06-04',
        amountCents: 1000,
        account: 'savings',
      },
      { kind: 'expense', entryDate: '2026-06-30', amountCents: 9000 },
    ]) {
      const response = await client
        .post('/api/v1/entries')
        .header('Authorization', auth)
        .json(entry)
      response.assertStatus(201)
    }
    const actuals = await client
      .get('/api/v1/months/2026-06/actuals?today=2026-06-10')
      .header('Authorization', auth)
    actuals.assertBody({
      data: {
        incomeCents: 10000,
        spendingCents: 2000,
        transferToSavingsCents: 5000,
        moneyLeftTodayCents: 99000,
      },
    })
    const balances = await client
      .get('/api/v1/balances?asOf=2026-06-10')
      .header('Authorization', auth)
    balances.assertBodyContains({
      data: { spendableCents: 99000, savingsCents: 26000, combinedCents: 125000 },
    })
    const invalidDate = await client
      .get('/api/v1/months/2026-06/actuals?today=2026-02-30')
      .header('Authorization', auth)
    invalidDate.assertStatus(422)
    const invalidMonth = await client
      .get('/api/v1/months/2026-13/actuals?today=2026-06-10')
      .header('Authorization', auth)
    invalidMonth.assertStatus(422)
  })

  test('malformed bearer credentials and unknown routes have stable public errors', async ({
    client,
  }) => {
    for (const value of [
      'Basic abc',
      'Bearer short',
      `Bearer ${'x'.repeat(257)}`,
      `Bearer ${'x'.repeat(32)}`,
    ]) {
      const response = await client.get('/api/v1/categories').header('Authorization', value)
      response.assertStatus(401)
      response.assertBody({ code: 'DEVICE_AUTH_REQUIRED' })
    }
    const missing = await client.get('/api/v1/not-a-route')
    missing.assertStatus(404)
    missing.assertBodyContains({ code: 'NOT_FOUND' })
  })
  test('one rejected sync write does not prevent a valid write and pagination advances', async ({
    client,
    assert,
  }) => {
    const auth = await pair(client)
    const rejectedId = randomUUID()
    const acceptedId = randomUUID()
    const response = await client
      .post('/api/v1/sync/push')
      .header('Authorization', auth)
      .json({
        operations: [
          {
            operationId: rejectedId,
            entityType: 'ledger_entry',
            entityId: randomUUID(),
            action: 'create',
            baseRevision: 0,
            value: { kind: 'expense', entryDate: '2026-06-10', amountCents: -1 },
          },
          {
            operationId: acceptedId,
            entityType: 'category',
            entityId: randomUUID(),
            action: 'create',
            baseRevision: 0,
            value: { name: 'Food' },
          },
          {
            operationId: randomUUID(),
            entityType: 'category',
            entityId: randomUUID(),
            action: 'create',
            baseRevision: 0,
            value: { name: 'Food' },
          },
        ],
      })
    response.assertStatus(200)
    response.assertBodyContains({
      data: {
        outcomes: [
          { operationId: rejectedId, status: 'rejected', code: 'INVALID_OPERATION' },
          { operationId: acceptedId, status: 'accepted' },
          {
            status: 'rejected',
            code: 'DUPLICATE_RESOURCE',
            message: 'A record with these unique values already exists',
          },
        ],
      },
    })
    const entries = await client.get('/api/v1/entries').header('Authorization', auth)
    entries.assertBody({ data: [] })
    const first = await client
      .get('/api/v1/sync/changes?cursor=0&limit=1')
      .header('Authorization', auth)
    first.assertStatus(200)
    assert.lengthOf(first.body().data.changes, 1)
    assert.isTrue(first.body().data.hasMore)
    const second = await client
      .get(`/api/v1/sync/changes?cursor=${first.body().data.nextCursor}&limit=1`)
      .header('Authorization', auth)
    second.assertStatus(200)
    assert.lengthOf(second.body().data.changes, 1)
    assert.isFalse(second.body().data.hasMore)
    assert.isAbove(second.body().data.nextCursor, first.body().data.nextCursor)
  })

  test('reversed recurring edit ranges are rejected without changing the rule', async ({
    client,
  }) => {
    const auth = await pair(client)
    const rule = await client.post('/api/v1/recurring-rules').header('Authorization', auth).json({
      kind: 'bill',
      name: 'Internet',
      amountCents: 6500,
      frequency: 'monthly',
      interval: 1,
      startsOn: '2026-06-01',
    })
    rule.assertStatus(201)
    const id = rule.body().data.id
    const update = await client
      .patch(`/api/v1/recurring-rules/${id}`)
      .header('Authorization', auth)
      .json({ amountCents: 9000, revision: 1, from: '2026-07-01', through: '2026-06-01' })
    update.assertStatus(422)
    const deleted = await client
      .delete(`/api/v1/recurring-rules/${id}`)
      .header('Authorization', auth)
      .json({ revision: 1, from: '2026-07-01', through: '2026-06-01' })
    deleted.assertStatus(422)
    const retained = await client.get(`/api/v1/recurring-rules/${id}`).header('Authorization', auth)
    retained.assertBodyContains({ data: { id, amountCents: 6500, revision: 1 } })
  })
  test('missing phones cannot be renamed or revoked and invalid ledger combinations do not write', async ({
    client,
  }) => {
    const auth = await pair(client)
    const id = randomUUID()
    const rename = await client
      .patch(`/api/v1/devices/${id}`)
      .header('Authorization', auth)
      .json({ label: 'Missing phone' })
    rename.assertStatus(404)
    rename.assertBodyContains({ code: 'DEVICE_NOT_FOUND' })
    const revoke = await client.delete(`/api/v1/devices/${id}`).header('Authorization', auth)
    revoke.assertStatus(404)
    revoke.assertBodyContains({ code: 'DEVICE_NOT_FOUND' })
    for (const entry of [
      { kind: 'expense', amountCents: -1 },
      { kind: 'expense', amountCents: 0 },
      { kind: 'balance_adjustment', amountCents: 10 },
      { kind: 'expense', amountCents: 10, account: 'savings' },
      { kind: 'savings_transfer', amountCents: 10, categoryId: randomUUID() },
    ]) {
      const invalid = await client
        .post('/api/v1/entries')
        .header('Authorization', auth)
        .json({ ...entry, entryDate: '2026-06-01' })
      invalid.assertStatus(422)
      invalid.assertBodyContains({ code: 'VALIDATION_ERROR' })
    }
    const entries = await client.get('/api/v1/entries').header('Authorization', auth)
    entries.assertBody({ data: [] })
  })

  test('unconfigured install surfaces return publication errors', async ({ client }) => {
    const directory = process.env.APK_DIRECTORY
    const baseUrl = process.env.INSTALL_BASE_URL
    delete process.env.APK_DIRECTORY
    delete process.env.INSTALL_BASE_URL
    try {
      for (const route of ['/install', '/install/version.json', '/install/budget.apk']) {
        const response = await client.get(route)
        response.assertStatus(404)
        response.assertBody({ code: 'APK_NOT_PUBLISHED' })
      }
    } finally {
      if (directory === undefined) delete process.env.APK_DIRECTORY
      else process.env.APK_DIRECTORY = directory
      if (baseUrl === undefined) delete process.env.INSTALL_BASE_URL
      else process.env.INSTALL_BASE_URL = baseUrl
    }
  })
  test('malformed JSON is rejected before creating an entry', async ({ client }) => {
    const auth = await pair(client)
    const invalid = await client
      .post('/api/v1/entries')
      .header('Authorization', auth)
      .unsafeJson('{"kind":')
    invalid.assertStatus(400)
    invalid.assertBody({ code: 'BAD_REQUEST' })
    const entries = await client.get('/api/v1/entries').header('Authorization', auth)
    entries.assertBody({ data: [] })
  })
})
