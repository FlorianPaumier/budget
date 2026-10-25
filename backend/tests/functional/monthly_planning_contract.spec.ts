import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

function payload(response: { body: () => any }) {
  return response.body().data ?? response.body()
}

test.group('monthly planning resource contract', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('plan includes editable estimate and savings-target resources with stable revisions', async ({
    client,
  }) => {
    const setup = await client
      .post('/api/v1/bootstrap')
      .json({ openingSpendableCents: 100000, openingSavingsCents: 0, reminderTime: '09:00' })
    const paired = await client
      .post('/api/v1/pair')
      .json({ pairingCode: payload(setup).pairingCode, label: 'Phone' })
    const auth = `Bearer ${payload(paired).credential}`
    const category = await client
      .post('/api/v1/categories')
      .header('Authorization', auth)
      .json({ name: 'Food' })
    const categoryId = payload(category).id
    const estimate = await client
      .put(`/api/v1/months/2026-10/estimates/${categoryId}`)
      .header('Authorization', auth)
      .json({ amountCents: 20000, revision: 0 })
    estimate.assertStatus(200)
    const estimateId = estimate.body().data?.id
    if (!estimateId) throw new Error('Missing estimate resource')
    estimate.assertBodyContains({
      data: { id: estimateId, categoryId, month: '2026-10', amountCents: 20000, revision: 1 },
    })
    const savings = await client
      .put('/api/v1/months/2026-10/savings-target')
      .header('Authorization', auth)
      .json({ amountCents: 5000, revision: 0 })
    savings.assertStatus(200)
    const targetId = savings.body().data?.id
    if (!targetId) throw new Error('Missing savings target resource')
    savings.assertBodyContains({
      data: { id: targetId, month: '2026-10', amountCents: 5000, revision: 1 },
    })
    const plan = await client.get('/api/v1/months/2026-10/plan').header('Authorization', auth)
    plan.assertStatus(200)
    plan.assertBodyContains({
      data: {
        moneyLeftCents: 75000,
        estimates: [{ id: estimateId, categoryId, revision: 1 }],
        savingsTarget: { id: targetId, amountCents: 5000, revision: 1 },
      },
    })
  })

  test('monthly writes reject stale revisions and malformed months', async ({ client }) => {
    const setup = await client
      .post('/api/v1/bootstrap')
      .json({ openingSpendableCents: 0, openingSavingsCents: 0, reminderTime: '09:00' })
    const paired = await client
      .post('/api/v1/pair')
      .json({ pairingCode: payload(setup).pairingCode, label: 'Phone' })
    const auth = `Bearer ${payload(paired).credential}`
    const category = await client
      .post('/api/v1/categories')
      .header('Authorization', auth)
      .json({ name: 'Food' })
    const categoryId = payload(category).id
    const url = `/api/v1/months/2026-10/estimates/${categoryId}`
    const created = await client
      .put(url)
      .header('Authorization', auth)
      .json({ amountCents: 10000, revision: 0 })
    created.assertStatus(200)
    const stale = await client
      .put(url)
      .header('Authorization', auth)
      .json({ amountCents: 12000, revision: 0 })
    stale.assertStatus(409)
    const invalid = await client.get('/api/v1/months/2026-13/plan').header('Authorization', auth)
    invalid.assertStatus(422)
    invalid.assertBodyContains({ code: 'VALIDATION_ERROR' })
  })
})
