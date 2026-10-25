import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { randomUUID } from 'node:crypto'

function payload(response: { body: () => any }) {
  return response.body().data ?? response.body()
}

test.group('recurring resource contract', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('a paired phone can list, show, edit, and delete a recurring rule as a resource', async ({
    client,
  }) => {
    const setup = await client
      .post('/api/v1/bootstrap')
      .json({ openingSpendableCents: 0, openingSavingsCents: 0, reminderTime: '09:00' })
    const paired = await client
      .post('/api/v1/pair')
      .json({ pairingCode: payload(setup).pairingCode, label: 'Phone' })
    const auth = `Bearer ${payload(paired).credential}`
    const created = await client
      .post('/api/v1/recurring-rules')
      .header('Authorization', auth)
      .json({
        kind: 'bill',
        name: 'Internet',
        amountCents: 6500,
        categoryId: null,
        frequency: 'monthly',
        interval: 1,
        startsOn: '2026-01-31',
        endsOn: null,
      })
    created.assertStatus(201)
    const rule = created.body().data
    if (!rule?.id) throw new Error('Missing rule resource')
    created.assertBodyContains({
      data: { id: rule.id, name: 'Internet', amountCents: 6500, revision: 1 },
    })

    const listed = await client.get('/api/v1/recurring-rules').header('Authorization', auth)
    listed.assertStatus(200)
    listed.assertBodyContains({ data: [{ id: rule.id, name: 'Internet' }] })
    const shown = await client
      .get(`/api/v1/recurring-rules/${rule.id}`)
      .header('Authorization', auth)
    shown.assertStatus(200)
    shown.assertBodyContains({ data: { id: rule.id, revision: 1 } })

    const edited = await client
      .patch(`/api/v1/recurring-rules/${rule.id}`)
      .header('Authorization', auth)
      .json({ amountCents: 7000, revision: 1, from: '2026-02-01', through: '2026-03-31' })
    edited.assertStatus(200)
    edited.assertBodyContains({ data: { id: rule.id, amountCents: 7000, revision: 2 } })
    const removed = await client
      .delete(`/api/v1/recurring-rules/${rule.id}`)
      .header('Authorization', auth)
      .json({ revision: 2, from: '2026-02-01', through: '2026-03-31' })
    removed.assertStatus(204)
    const absent = await client
      .get(`/api/v1/recurring-rules/${rule.id}`)
      .header('Authorization', auth)
    absent.assertStatus(404)
  })

  test('invalid recurrence dates and values return validation errors', async ({ client }) => {
    const setup = await client
      .post('/api/v1/bootstrap')
      .json({ openingSpendableCents: 0, openingSavingsCents: 0, reminderTime: '09:00' })
    const paired = await client
      .post('/api/v1/pair')
      .json({ pairingCode: payload(setup).pairingCode, label: 'Phone' })
    const auth = `Bearer ${payload(paired).credential}`
    const invalid = await client
      .post('/api/v1/recurring-rules')
      .header('Authorization', auth)
      .json({
        kind: 'bill',
        name: 'Internet',
        amountCents: -1,
        frequency: 'monthly',
        interval: 1,
        startsOn: '2026-02-30',
      })
    invalid.assertStatus(422)
    invalid.assertBodyContains({ code: 'VALIDATION_ERROR' })
    const range = await client
      .get('/api/v1/occurrences?from=2026-03-01&through=2026-02-01')
      .header('Authorization', auth)
    range.assertStatus(422)
    range.assertBodyContains({ code: 'VALIDATION_ERROR' })
    const invalidRuleId = await client
      .patch('/api/v1/recurring-rules/not-a-uuid')
      .header('Authorization', auth)
      .json({ active: false, revision: 1, from: '2026-02-01', through: '2026-03-01' })
    invalidRuleId.assertStatus(422)
    const invalidOccurrenceId = await client
      .post('/api/v1/occurrences/not-a-uuid/confirm')
      .header('Authorization', auth)
      .json({ revision: 1 })
    invalidOccurrenceId.assertStatus(422)
    const foreignCategory = await client
      .post('/api/v1/recurring-rules')
      .header('Authorization', auth)
      .json({
        kind: 'bill',
        name: 'Foreign category',
        amountCents: 5000,
        categoryId: randomUUID(),
        frequency: 'monthly',
        interval: 1,
        startsOn: '2026-01-01',
      })
    foreignCategory.assertStatus(404)
  })
})
