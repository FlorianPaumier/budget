import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

function payload(response: { body: () => any }) {
  return response.body().data ?? response.body()
}

test.group('Recurring API', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('paired phone creates a rule, receives occurrences, and confirms one', async ({
    client,
  }) => {
    const bootstrap = await client
      .post('/api/v1/bootstrap')
      .json({ openingSpendableCents: 0, openingSavingsCents: 0, reminderTime: '09:00' })
    const paired = await client
      .post('/api/v1/pair')
      .json({ pairingCode: payload(bootstrap).pairingCode, label: 'Phone' })
    const auth = `Bearer ${payload(paired).credential}`

    const rule = await client.post('/api/v1/recurring-rules').header('Authorization', auth).json({
      kind: 'bill',
      name: 'Internet',
      amountCents: 6500,
      categoryId: null,
      frequency: 'monthly',
      interval: 1,
      startsOn: '2026-01-31',
      endsOn: null,
    })
    rule.assertStatus(201)

    const feed = await client
      .get('/api/v1/occurrences?from=2026-02-01&through=2026-02-28&today=2026-02-27')
      .header('Authorization', auth)
    feed.assertStatus(200)
    feed.assertBodyContains({
      data: [
        {
          expectedDate: '2026-02-28',
          displayStatus: 'upcoming',
          ruleName: 'Internet',
          ruleKind: 'bill',
        },
      ],
    })
    const occurrenceId = feed.body().data[0].id

    const missingRevision = await client
      .post(`/api/v1/occurrences/${occurrenceId}/confirm`)
      .header('Authorization', auth)
      .json({ actualDate: '2026-03-01', actualAmountCents: 6600 })
    missingRevision.assertStatus(422)
    const confirmed = await client
      .post(`/api/v1/occurrences/${occurrenceId}/confirm`)
      .header('Authorization', auth)
      .json({ actualDate: '2026-03-01', actualAmountCents: 6600, revision: 1 })
    confirmed.assertStatus(200)
    confirmed.assertBodyContains({
      data: { entry: { amountCents: 6600, entryDate: '2026-03-01' } },
    })
  })

  test('unpaired phone cannot read recurring items', async ({ client }) => {
    const response = await client.get('/api/v1/occurrences?from=2026-02-01&through=2026-02-28')
    response.assertStatus(401)
  })

  test('rule edits require the current revision', async ({ client }) => {
    const bootstrap = await client
      .post('/api/v1/bootstrap')
      .json({ openingSpendableCents: 0, openingSavingsCents: 0, reminderTime: '09:00' })
    const paired = await client
      .post('/api/v1/pair')
      .json({ pairingCode: payload(bootstrap).pairingCode, label: 'Phone' })
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
    const id = created.body().data.id
    const url = `/api/v1/recurring-rules/${id}`
    const body = { amountCents: 7000, from: '2026-02-01', through: '2026-03-31' }
    const missing = await client.patch(url).header('Authorization', auth).json(body)
    missing.assertStatus(422)
    const stale = await client
      .patch(url)
      .header('Authorization', auth)
      .json({ ...body, revision: 2 })
    stale.assertStatus(409)
    const accepted = await client
      .patch(url)
      .header('Authorization', auth)
      .json({ ...body, revision: 1 })
    accepted.assertStatus(200)
    accepted.assertBodyContains({ data: { revision: 2 } })
  })
})
