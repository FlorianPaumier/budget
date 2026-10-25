import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

test.group('protected ledger API', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('two phones see the same accepted totals and unauthenticated reads fail', async ({
    client,
  }) => {
    const bootstrap = await client
      .post('/api/v1/bootstrap')
      .json({ openingSpendableCents: 100000, openingSavingsCents: 50000, reminderTime: '09:00' })
    const first = await client
      .post('/api/v1/pair')
      .json({ pairingCode: bootstrap.body().data.pairingCode, label: 'Phone one' })
    const code = await client
      .post('/api/v1/pairing-codes')
      .header('Authorization', `Bearer ${first.body().data.credential}`)
    const second = await client
      .post('/api/v1/pair')
      .json({ pairingCode: code.body().data.pairingCode, label: 'Phone two' })
    const anonymous = await client.get('/api/v1/balances?asOf=2026-02-10')
    anonymous.assertStatus(401)

    const created = await client
      .post('/api/v1/entries')
      .header('Authorization', `Bearer ${first.body().data.credential}`)
      .json({ kind: 'expense', entryDate: '2026-02-10', amountCents: 2500 })
    created.assertStatus(201)
    const balance = await client
      .get('/api/v1/balances?asOf=2026-02-10')
      .header('Authorization', `Bearer ${second.body().data.credential}`)
    balance.assertStatus(200)
    balance.assertBodyContains({
      data: { spendableCents: 97500, savingsCents: 50000, combinedCents: 147500 },
    })
  })

  test('a paired phone can create and edit category and entry history', async ({ client }) => {
    const bootstrap = await client
      .post('/api/v1/bootstrap')
      .json({ openingSpendableCents: 0, openingSavingsCents: 0, reminderTime: '09:00' })
    const paired = await client
      .post('/api/v1/pair')
      .json({ pairingCode: bootstrap.body().data.pairingCode, label: 'Phone one' })
    const auth = `Bearer ${paired.body().data.credential}`
    const category = await client
      .post('/api/v1/categories')
      .header('Authorization', auth)
      .json({ name: 'Food' })
    category.assertStatus(201)
    const entry = await client.post('/api/v1/entries').header('Authorization', auth).json({
      kind: 'category_adjustment',
      entryDate: '2026-02-10',
      amountCents: 3000,
      categoryId: category.body().data.id,
    })
    entry.assertStatus(201)
    const updated = await client
      .patch(`/api/v1/entries/${entry.body().data.id}`)
      .header('Authorization', auth)
      .json({ amountCents: 3500, revision: 1 })
    updated.assertStatus(200)
    const stale = await client
      .patch(`/api/v1/entries/${entry.body().data.id}`)
      .header('Authorization', auth)
      .json({ amountCents: 4000, revision: 1 })
    stale.assertStatus(409)
    const noRevision = await client
      .patch(`/api/v1/entries/${entry.body().data.id}`)
      .header('Authorization', auth)
      .json({ amountCents: 4000 })
    noRevision.assertStatus(422)
    const history = await client
      .get(`/api/v1/entries/${entry.body().data.id}/history`)
      .header('Authorization', auth)
    history.assertStatus(200)
    history.assertBodyContains({
      data: [
        { beforeRevision: null, afterRevision: 1 },
        { beforeRevision: 1, afterRevision: 2 },
      ],
    })
  })

  test('entry detail and history expose camelCase values and actor information', async ({
    client,
  }) => {
    const bootstrap = await client
      .post('/api/v1/bootstrap')
      .json({ openingSpendableCents: 0, openingSavingsCents: 0, reminderTime: '09:00' })
    const paired = await client
      .post('/api/v1/pair')
      .json({ pairingCode: bootstrap.body().data.pairingCode, label: 'Phone' })
    const auth = `Bearer ${paired.body().data.credential}`
    const created = await client
      .post('/api/v1/entries')
      .header('Authorization', auth)
      .json({ kind: 'expense', entryDate: '2026-10-01', amountCents: 1234 })
    created.assertBodyContains({
      data: { kind: 'expense', entryDate: '2026-10-01', amountCents: 1234, revision: 1 },
    })
    const id = created.body().data.id
    const detail = await client.get(`/api/v1/entries/${id}`).header('Authorization', auth)
    detail.assertStatus(200)
    detail.assertBodyContains({ data: { id, amountCents: 1234 } })
    const edited = await client
      .patch(`/api/v1/entries/${id}`)
      .header('Authorization', auth)
      .json({ amountCents: 2345, revision: 1 })
    edited.assertStatus(200)
    const history = await client.get(`/api/v1/entries/${id}/history`).header('Authorization', auth)
    history.assertBodyContains({
      data: [
        { deviceId: paired.body().data.deviceId, beforeRevision: null, afterRevision: 1 },
        {
          beforeRevision: 1,
          afterRevision: 2,
          before: { amountCents: 1234 },
          after: { amountCents: 2345 },
        },
      ],
    })
    if (
      history.body().data[0].createdAt === undefined ||
      history.body().data[0].after?.amountCents !== 1234 ||
      history.body().data[1].deviceLabel !== 'Phone'
    )
      throw new Error('History lacks actor or changed entry value')
    const missing = await client
      .get(`/api/v1/entries/00000000-0000-4000-8000-000000000000`)
      .header('Authorization', auth)
    missing.assertStatus(404)
  })

  test('invalid cents, dates, and IDs return validation errors without writes', async ({
    client,
  }) => {
    const bootstrap = await client
      .post('/api/v1/bootstrap')
      .json({ openingSpendableCents: 0, openingSavingsCents: 0, reminderTime: '09:00' })
    const paired = await client
      .post('/api/v1/pair')
      .json({ pairingCode: bootstrap.body().data.pairingCode, label: 'Phone' })
    const auth = `Bearer ${paired.body().data.credential}`
    const invalidEntry = await client
      .post('/api/v1/entries')
      .header('Authorization', auth)
      .json({ kind: 'expense', entryDate: '2026-02-30', amountCents: 1.5 })
    invalidEntry.assertStatus(422)
    invalidEntry.assertBodyContains({ code: 'VALIDATION_ERROR' })
    const invalidId = await client.get('/api/v1/entries/not-a-uuid').header('Authorization', auth)
    invalidId.assertStatus(422)
    const invalidMonth = await client
      .get('/api/v1/entries?month=2026-13')
      .header('Authorization', auth)
    invalidMonth.assertStatus(422)
  })
})
