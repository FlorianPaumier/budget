import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

function payload(response: { body: () => any }) {
  return response.body().data ?? response.body()
}

test.group('protected monthly planning API', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('a phone can set an estimate and target, then read a distinct monthly plan', async ({
    client,
  }) => {
    const bootstrap = await client
      .post('/api/v1/bootstrap')
      .json({ openingSpendableCents: 100000, openingSavingsCents: 0, reminderTime: '09:00' })
    const paired = await client
      .post('/api/v1/pair')
      .json({ pairingCode: payload(bootstrap).pairingCode, label: 'Phone' })
    const auth = `Bearer ${payload(paired).credential}`
    const category = await client
      .post('/api/v1/categories')
      .header('Authorization', auth)
      .json({ name: 'Food' })
    const estimate = await client
      .put(`/api/v1/months/2026-10/estimates/${payload(category).id}`)
      .header('Authorization', auth)
      .json({ amountCents: 20000, revision: 0 })
    estimate.assertStatus(200)
    const savings = await client
      .put('/api/v1/months/2026-10/savings-target')
      .header('Authorization', auth)
      .json({ amountCents: 5000, revision: 0 })
    savings.assertStatus(200)
    const plan = await client.get('/api/v1/months/2026-10/plan').header('Authorization', auth)
    plan.assertStatus(200)
    plan.assertBodyContains({
      data: { moneyLeftCents: 75000, estimateCents: 20000, savingsTargetCents: 5000 },
    })
    const anonymous = await client.get('/api/v1/months/2026-10/plan')
    anonymous.assertStatus(401)
  })

  test('month plan includes scheduled income before occurrences were explicitly requested', async ({
    client,
  }) => {
    const bootstrap = await client
      .post('/api/v1/bootstrap')
      .json({ openingSpendableCents: 10000, openingSavingsCents: 0, reminderTime: '09:00' })
    const paired = await client
      .post('/api/v1/pair')
      .json({ pairingCode: payload(bootstrap).pairingCode, label: 'Phone' })
    const auth = `Bearer ${payload(paired).credential}`
    const rule = await client.post('/api/v1/recurring-rules').header('Authorization', auth).json({
      kind: 'income',
      name: 'Salary',
      amountCents: 20000,
      frequency: 'monthly',
      interval: 1,
      startsOn: '2026-10-05',
      endsOn: null,
    })
    rule.assertStatus(201)
    const plan = await client.get('/api/v1/months/2026-10/plan').header('Authorization', auth)
    plan.assertStatus(200)
    plan.assertBodyContains({ data: { expectedIncomeCents: 20000, moneyLeftCents: 30000 } })
  })
})
