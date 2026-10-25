import { test } from '@japa/runner'
import knex from 'knex'
import { randomUUID } from 'node:crypto'
import {
  confirmOccurrence,
  generateOccurrences,
  listOccurrences,
  autoConfirmOverdue,
  refreshOccurrences,
  createRecurringRule,
  updateRecurringRule,
  deleteRecurringRule,
  processOverdueHouseholds,
} from '../../app/services/recurrence_store.js'

async function fixture(kind: 'income' | 'bill' | 'subscription' = 'bill') {
  const database = knex({
    client: 'better-sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true,
  })
  await database.schema.createTable('recurring_rules', (t) => {
    t.string('id').primary()
    t.string('household_id')
    t.string('kind')
    t.string('name')
    t.string('category_id')
    t.integer('amount_cents')
    t.string('frequency')
    t.integer('interval')
    t.string('starts_on')
    t.string('ends_on')
    t.string('schedule_details')
    t.integer('active')
    t.integer('revision')
    t.string('deleted_at')
  })
  await database.schema.createTable('occurrences', (t) => {
    t.string('id').primary()
    t.string('household_id')
    t.string('rule_id')
    t.string('expected_date')
    t.integer('expected_amount_cents')
    t.string('status')
    t.string('actual_date')
    t.integer('actual_amount_cents')
    t.string('confirmation_method')
    t.boolean('needs_review')
    t.integer('revision')
    t.string('deleted_at')
    t.unique(['rule_id', 'expected_date'])
  })
  await database.schema.createTable('ledger_entries', (t) => {
    t.string('id').primary()
    t.string('household_id')
    t.string('occurrence_id').unique()
    t.string('category_id')
    t.string('entry_date')
    t.string('kind')
    t.integer('amount_cents')
    t.string('note')
    t.integer('revision')
    t.string('deleted_at')
  })
  await database.schema.createTable('change_events', (t) => {
    t.string('id').primary()
    t.string('household_id')
    t.string('device_id')
    t.string('entity_type')
    t.string('entity_id')
    t.integer('before_revision')
    t.integer('after_revision')
    t.string('operation_id')
    t.string('created_at')
    t.text('before_value')
    t.text('after_value')
  })
  await database.schema.createTable('households', (t) => {
    t.string('id').primary()
    t.string('time_zone')
  })
  const householdId = randomUUID()
  const ruleId = randomUUID()
  await database('households').insert({ id: householdId, time_zone: 'America/Toronto' })
  await database('recurring_rules').insert({
    id: ruleId,
    household_id: householdId,
    kind,
    name: 'Pay',
    category_id: null,
    amount_cents: 10000,
    frequency: 'monthly',
    interval: 1,
    starts_on: '2026-01-31',
    ends_on: null,
    schedule_details: null,
    active: 1,
    revision: 1,
  })
  return { database, householdId, ruleId }
}

test.group('occurrence lifecycle', () => {
  test('creates a validated rule that can generate occurrences', async ({ assert }) => {
    const { database, householdId } = await fixture()
    try {
      const rule = await createRecurringRule(database, householdId, {
        kind: 'subscription',
        name: 'Internet',
        amountCents: 6500,
        frequency: 'monthly',
        interval: 1,
        startsOn: '2026-01-31',
        endsOn: null,
        categoryId: null,
      })
      await generateOccurrences(database, householdId, rule.id, '2026-02-01', '2026-02-28')
      const occurrence = await database('occurrences').where({ rule_id: rule.id }).first()
      assert.equal(occurrence.expected_date, '2026-02-28')
      assert.equal(occurrence.expected_amount_cents, 6500)
    } finally {
      await database.destroy()
    }
  })
  test('generation is idempotent across short months', async ({ assert }) => {
    const { database, householdId, ruleId } = await fixture()
    try {
      await generateOccurrences(database, householdId, ruleId, '2026-02-01', '2026-03-31')
      await generateOccurrences(database, householdId, ruleId, '2026-02-01', '2026-03-31')
      const rows = await database('occurrences').orderBy('expected_date')
      assert.deepEqual(
        rows.map((r) => r.expected_date),
        ['2026-02-28', '2026-03-31']
      )
    } finally {
      await database.destroy()
    }
  })

  test('confirmation creates exactly one linked ledger entry with corrected amount and date', async ({
    assert,
  }) => {
    const { database, householdId, ruleId } = await fixture()
    try {
      await generateOccurrences(database, householdId, ruleId, '2026-02-01', '2026-02-28')
      const occurrence = await database('occurrences').first()
      await confirmOccurrence(database, householdId, occurrence.id, {
        actualDate: '2026-03-01',
        actualAmountCents: 10500,
      })
      await confirmOccurrence(database, householdId, occurrence.id, {})
      const entries = await database('ledger_entries')
      assert.lengthOf(entries, 1)
      assert.equal(entries[0].amount_cents, 10500)
      assert.equal(entries[0].entry_date, '2026-03-01')
      assert.equal(entries[0].occurrence_id, occurrence.id)
    } finally {
      await database.destroy()
    }
  })

  test('overdue income remains expected while bills auto-confirm after two days', async ({
    assert,
  }) => {
    const income = await fixture('income')
    const bill = await fixture('bill')
    try {
      for (const f of [income, bill]) {
        await generateOccurrences(f.database, f.householdId, f.ruleId, '2026-01-31', '2026-01-31')
        await autoConfirmOverdue(f.database, f.householdId, '2026-02-02')
      }
      assert.equal(
        await income
          .database('occurrences')
          .first()
          .then((result) => result.status),
        'expected'
      )
      assert.equal(
        await bill
          .database('occurrences')
          .first()
          .then((result) => result.confirmation_method),
        'automatic'
      )
      assert.equal(
        await bill
          .database('occurrences')
          .first()
          .then((result) => result.needs_review),
        1
      )
      assert.lengthOf(await bill.database('ledger_entries'), 1)
    } finally {
      await income.database.destroy()
      await bill.database.destroy()
    }
  })

  test('listing classifies upcoming, due, overdue, and confirmed', async ({ assert }) => {
    const { database, householdId, ruleId } = await fixture()
    try {
      await generateOccurrences(database, householdId, ruleId, '2026-01-31', '2026-04-30')
      const jan = await database('occurrences').where('expected_date', '2026-01-31').first()
      await confirmOccurrence(database, householdId, jan.id, {})
      const rows = await listOccurrences(database, householdId, '2026-03-31')
      assert.deepEqual(
        rows.map((r) => r.displayStatus),
        ['confirmed', 'overdue', 'due', 'upcoming']
      )
      assert.equal(rows[1].ruleName, 'Pay')
      assert.equal(rows[1].ruleKind, 'bill')
    } finally {
      await database.destroy()
    }
  })

  test('edited rules replace future expected dates but preserve confirmed history', async ({
    assert,
  }) => {
    const { database, householdId, ruleId } = await fixture()
    try {
      await generateOccurrences(database, householdId, ruleId, '2026-01-01', '2026-03-31')
      const jan = await database('occurrences').where('expected_date', '2026-01-31').first()
      await confirmOccurrence(database, householdId, jan.id, {})
      await database('recurring_rules')
        .where({ id: ruleId })
        .update({ starts_on: '2026-02-15', amount_cents: 12000, revision: 2 })
      await refreshOccurrences(database, householdId, ruleId, '2026-02-01', '2026-03-31')
      const rows = await database('occurrences').orderBy('expected_date')
      assert.deepEqual(
        rows.map((r) => r.expected_date),
        ['2026-01-31', '2026-02-15', '2026-03-15']
      )
      assert.equal(rows[0].status, 'confirmed')
      assert.deepEqual(
        rows.slice(1).map((r) => r.expected_amount_cents),
        [12000, 12000]
      )
      assert.lengthOf(await database('ledger_entries'), 1)
    } finally {
      await database.destroy()
    }
  })

  test('updating a rule refreshes future expected dates in one operation', async ({ assert }) => {
    const { database, householdId, ruleId } = await fixture()
    try {
      await generateOccurrences(database, householdId, ruleId, '2026-02-01', '2026-03-31')
      await updateRecurringRule(
        database,
        householdId,
        ruleId,
        { startsOn: '2026-02-15', amountCents: 8000 },
        '2026-02-01',
        '2026-03-31'
      )
      const rows = await database('occurrences').orderBy('expected_date')
      assert.deepEqual(
        rows.map((r) => r.expected_date),
        ['2026-02-15', '2026-03-15']
      )
      assert.deepEqual(
        rows.map((r) => r.expected_amount_cents),
        [8000, 8000]
      )
      assert.equal(
        await database('recurring_rules')
          .where({ id: ruleId })
          .first()
          .then((result) => result.revision),
        2
      )
      const removed = await database('change_events').where({
        entity_type: 'occurrence',
        after_revision: null,
      })
      assert.lengthOf(removed, 2)
    } finally {
      await database.destroy()
    }
  })

  test('rule and occurrence mutations publish revisions for offline sync', async ({ assert }) => {
    const { database, householdId } = await fixture()
    try {
      const deviceId = randomUUID()
      const rule = await createRecurringRule(
        database,
        householdId,
        {
          kind: 'bill',
          name: 'Heat',
          categoryId: null,
          amountCents: 3000,
          frequency: 'monthly',
          interval: 1,
          startsOn: '2026-01-31',
          endsOn: null,
        },
        deviceId
      )
      await generateOccurrences(database, householdId, rule.id, '2026-02-01', '2026-02-28')
      const occurrence = await database('occurrences').where({ rule_id: rule.id }).first()
      await confirmOccurrence(database, householdId, occurrence.id, {}, 'manual', deviceId)
      const events = await database('change_events').orderBy('rowid')
      assert.deepEqual(
        events.map((event) => [event.entity_type, event.after_revision, event.device_id]),
        [
          ['recurring_rule', 1, deviceId],
          ['occurrence', 1, null],
          ['ledger_entry', 1, deviceId],
          ['occurrence', 2, deviceId],
        ]
      )
    } finally {
      await database.destroy()
    }
  })

  test('automatic processing waits two full household calendar days', async ({ assert }) => {
    const { database, householdId, ruleId } = await fixture('bill')
    try {
      await generateOccurrences(database, householdId, ruleId, '2026-01-31', '2026-01-31')
      await processOverdueHouseholds(database, '2026-02-02T04:30:00Z')
      assert.equal(
        await database('occurrences')
          .first()
          .then((result) => result.status),
        'expected'
      )
      await processOverdueHouseholds(database, '2026-02-03T04:30:00Z')
      assert.equal(
        await database('occurrences')
          .first()
          .then((result) => result.confirmation_method),
        'automatic'
      )
    } finally {
      await database.destroy()
    }
  })

  test('worker generates due bills before confirming them when no phone opened the month', async ({
    assert,
  }) => {
    const { database, householdId } = await fixture('bill')
    try {
      await processOverdueHouseholds(database, '2026-02-03T16:00:00Z')
      const jan = await database('occurrences')
        .where({ household_id: householdId, expected_date: '2026-01-31' })
        .first()
      assert.equal(jan.status, 'confirmed')
      assert.equal(jan.confirmation_method, 'automatic')
      assert.lengthOf(await database('ledger_entries'), 1)
    } finally {
      await database.destroy()
    }
  })

  test('phone supplied rule ID and operation ID are preserved for sync', async ({ assert }) => {
    const { database, householdId } = await fixture()
    try {
      const ruleId = randomUUID()
      const operationId = randomUUID()
      const deviceId = randomUUID()
      const rule = await createRecurringRule(
        database,
        householdId,
        {
          kind: 'income',
          name: 'Pay',
          categoryId: null,
          amountCents: 20000,
          frequency: 'biweekly',
          interval: 1,
          startsOn: '2026-01-01',
          endsOn: null,
        },
        deviceId,
        { id: ruleId, operationId }
      )
      assert.equal(rule.id, ruleId)
      const event = await database('change_events').where({ entity_id: ruleId }).first()
      assert.equal(event.operation_id, operationId)
      assert.equal(event.device_id, deviceId)
    } finally {
      await database.destroy()
    }
  })

  test('stale rule edit is rejected without changing the rule or events', async ({ assert }) => {
    const { database, householdId, ruleId } = await fixture()
    try {
      await assert.rejects(
        () =>
          updateRecurringRule(
            database,
            householdId,
            ruleId,
            { amountCents: 8000 },
            '2026-02-01',
            '2026-03-31',
            randomUUID(),
            { baseRevision: 2, operationId: randomUUID() }
          ),
        /Revision conflict/
      )
      assert.equal(
        await database('recurring_rules')
          .where({ id: ruleId })
          .first()
          .then((result) => result.amount_cents),
        10000
      )
      assert.lengthOf(await database('change_events'), 0)
    } finally {
      await database.destroy()
    }
  })

  test('rule deletion produces a revisioned tombstone and removes future expected occurrences', async ({
    assert,
  }) => {
    const { database, householdId, ruleId } = await fixture()
    try {
      await generateOccurrences(database, householdId, ruleId, '2026-02-01', '2026-05-31')
      await deleteRecurringRule(
        database,
        householdId,
        ruleId,
        '2026-02-01',
        '2026-03-31',
        randomUUID(),
        { baseRevision: 1, operationId: randomUUID() }
      )
      const rule = await database('recurring_rules').where({ id: ruleId }).first()
      assert.equal(rule.revision, 2)
      assert.isNotNull(rule.deleted_at)
      assert.lengthOf(await database('occurrences'), 0)
      const event = await database('change_events')
        .where({ entity_type: 'recurring_rule', entity_id: ruleId })
        .first()
      assert.equal(event.after_revision, 2)
    } finally {
      await database.destroy()
    }
  })

  test('confirmation rejects a stale occurrence revision and records its operation ID', async ({
    assert,
  }) => {
    const { database, householdId, ruleId } = await fixture()
    try {
      const deviceId = randomUUID()
      const operationId = randomUUID()
      await generateOccurrences(database, householdId, ruleId, '2026-01-31', '2026-01-31')
      const occurrence = await database('occurrences').first()
      await confirmOccurrence(database, householdId, occurrence.id, {}, 'manual', deviceId, {
        baseRevision: 1,
        operationId,
      })
      const event = await database('change_events')
        .where({ entity_type: 'occurrence', entity_id: occurrence.id, after_revision: 2 })
        .first()
      assert.equal(event.operation_id, operationId)
      await assert.rejects(
        () =>
          confirmOccurrence(database, householdId, occurrence.id, {}, 'manual', deviceId, {
            baseRevision: 1,
            operationId: randomUUID(),
          }),
        /Revision conflict/
      )
      assert.lengthOf(await database('ledger_entries'), 1)
    } finally {
      await database.destroy()
    }
  })

  test('correcting an auto-confirmed bill updates its linked entry and clears review warning', async ({
    assert,
  }) => {
    const { database, householdId, ruleId } = await fixture('bill')
    try {
      await generateOccurrences(database, householdId, ruleId, '2026-01-31', '2026-01-31')
      await autoConfirmOverdue(database, householdId, '2026-02-02')
      const occurrence = await database('occurrences').first()
      const originalEntry = await database('ledger_entries').first()
      await confirmOccurrence(
        database,
        householdId,
        occurrence.id,
        { actualDate: '2026-02-03', actualAmountCents: 11000 },
        'manual',
        randomUUID(),
        { baseRevision: 2, operationId: randomUUID() }
      )
      const corrected = await database('occurrences').where({ id: occurrence.id }).first()
      const entry = await database('ledger_entries').where({ occurrence_id: occurrence.id }).first()
      assert.equal(entry.id, originalEntry.id)
      assert.equal(entry.entry_date, '2026-02-03')
      assert.equal(entry.amount_cents, 11000)
      assert.equal(entry.revision, 2)
      assert.equal(corrected.revision, 3)
      assert.equal(corrected.needs_review, 0)
      assert.equal(corrected.confirmation_method, 'manual')
      assert.lengthOf(await database('ledger_entries'), 1)
      const createEvent = await database('change_events')
        .where({ entity_type: 'ledger_entry', entity_id: entry.id, after_revision: 1 })
        .first()
      const correctionEvent = await database('change_events')
        .where({ entity_type: 'ledger_entry', entity_id: entry.id, after_revision: 2 })
        .first()
      assert.equal(JSON.parse(createEvent.after_value).amount_cents, 10000)
      assert.equal(JSON.parse(correctionEvent.before_value).amount_cents, 10000)
      assert.equal(JSON.parse(correctionEvent.after_value).amount_cents, 11000)
    } finally {
      await database.destroy()
    }
  })
})

test('occurrence generation rolls back when publishing its event fails and retries cleanly', async ({
  assert,
}) => {
  const f = await fixture()
  try {
    await f.database.raw(
      "CREATE TRIGGER fail_occurrence_event BEFORE INSERT ON change_events BEGIN SELECT RAISE(ABORT, 'event failed'); END"
    )
    await assert.rejects(
      () => generateOccurrences(f.database, f.householdId, f.ruleId, '2026-01-31', '2026-01-31'),
      /event failed/
    )
    assert.lengthOf(await f.database('occurrences'), 0)
    await f.database.raw('DROP TRIGGER fail_occurrence_event')
    await generateOccurrences(f.database, f.householdId, f.ruleId, '2026-01-31', '2026-01-31')
    assert.lengthOf(await f.database('occurrences'), 1)
    assert.lengthOf(await f.database('change_events'), 1)
  } finally {
    await f.database.destroy()
  }
})
