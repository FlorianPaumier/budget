import { test } from '@japa/runner'
import knex from 'knex'
import { randomUUID } from 'node:crypto'
import {
  getRecurringRule,
  listOccurrencesInRange,
  confirmOccurrence,
  generateOccurrences,
  autoConfirmOverdue,
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
  await database.schema.createTable('categories', (t) => {
    t.string('id').primary()
    t.string('household_id')
    t.string('deleted_at')
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

test.group('recurring service boundaries', () => {
  test('rejects invalid rule amounts, identity metadata and rule names', async ({ assert }) => {
    const f = await fixture()
    const input = {
      kind: 'bill' as const,
      name: ' Internet ',
      categoryId: null,
      amountCents: 100,
      frequency: 'monthly' as const,
      interval: 1,
      startsOn: '2026-01-01',
      endsOn: null,
    }
    try {
      for (const changes of [
        { amountCents: 0 },
        { amountCents: 0.5 },
        { kind: 'unknown' },
        { name: ' ' },
        { name: 'x'.repeat(161) },
      ])
        await assert.rejects(
          () =>
            createRecurringRule(f.database, f.householdId, { ...input, ...changes } as Parameters<
              typeof createRecurringRule
            >[2]),
          /Invalid rule|Amount/
        )
      for (const options of [
        { id: 'bad' },
        { operationId: ' ' },
        { operationId: 'x'.repeat(101) },
        { baseRevision: 0 },
        { baseRevision: 0.5 },
      ])
        await assert.rejects(
          () => createRecurringRule(f.database, f.householdId, input, null, options),
          /Invalid/
        )
      await assert.rejects(
        () =>
          createRecurringRule(f.database, f.householdId, { ...input, categoryId: randomUUID() }),
        /Category not found/
      )
      const rule = await createRecurringRule(f.database, f.householdId, {
        ...input,
        frequency: 'twice_monthly',
        scheduleDetails: { days: [1, 15] },
      })
      assert.equal(
        await getRecurringRule(f.database, f.householdId, rule.id).then((value) => value.name),
        'Internet'
      )
      await updateRecurringRule(f.database, f.householdId, rule.id, {}, '2026-01-01', '2026-01-31')
      await updateRecurringRule(
        f.database,
        f.householdId,
        rule.id,
        {
          kind: 'subscription',
          name: ' Changed ',
          categoryId: null,
          frequency: 'weekly',
          interval: 2,
          startsOn: '2026-01-05',
          endsOn: '2026-02-01',
          scheduleDetails: null,
          active: false,
        },
        '2026-01-01',
        '2026-01-31'
      )
      assert.deepEqual(
        await generateOccurrences(f.database, f.householdId, rule.id, '2026-01-01', '2026-01-31'),
        []
      )
      assert.lengthOf(await f.database('occurrences').where({ rule_id: rule.id }), 0)
      const stored = await getRecurringRule(f.database, f.householdId, rule.id)
      assert.equal(stored.name, 'Changed')
      assert.equal(stored.revision, 3)
    } finally {
      await f.database.destroy()
    }
  })
  test('rules enforce ownership and revisions for edit, generation and deletion', async ({
    assert,
  }) => {
    const f = await fixture()
    try {
      await assert.rejects(() => getRecurringRule(f.database, randomUUID(), f.ruleId), /not found/)
      await assert.rejects(
        () =>
          updateRecurringRule(f.database, randomUUID(), f.ruleId, {}, '2026-01-01', '2026-02-28'),
        /not found/
      )
      await assert.rejects(
        () => generateOccurrences(f.database, randomUUID(), f.ruleId, '2026-01-01', '2026-02-28'),
        /not found/
      )
      await assert.rejects(
        () => deleteRecurringRule(f.database, randomUUID(), f.ruleId, '2026-01-01', '2026-02-28'),
        /not found/
      )
      await assert.rejects(
        () => deleteRecurringRule(f.database, f.householdId, f.ruleId, '2026-02-01', '2026-01-01'),
        /Invalid date range/
      )
      await assert.rejects(
        () =>
          deleteRecurringRule(
            f.database,
            f.householdId,
            f.ruleId,
            '2026-01-01',
            '2026-02-28',
            null,
            { baseRevision: 2 }
          ),
        /Revision conflict/
      )
      await assert.rejects(
        () =>
          updateRecurringRule(
            f.database,
            f.householdId,
            f.ruleId,
            {},
            '2026-01-01',
            '2026-02-28',
            null,
            { baseRevision: 2 }
          ),
        /Revision conflict/
      )
      for (const changes of [{ name: ' ' }, { name: 'x'.repeat(161) }, { kind: 'unknown' }])
        await assert.rejects(
          () =>
            updateRecurringRule(
              f.database,
              f.householdId,
              f.ruleId,
              changes as Parameters<typeof updateRecurringRule>[3],
              '2026-01-01',
              '2026-02-28'
            ),
          /Invalid rule/
        )
      assert.equal(
        await getRecurringRule(f.database, f.householdId, f.ruleId).then((value) => value.revision),
        1
      )
    } finally {
      await f.database.destroy()
    }
  })
  test('confirmation refuses malformed dates, stale revisions and inconsistent imported records', async ({
    assert,
  }) => {
    const f = await fixture()
    try {
      await assert.rejects(
        () => confirmOccurrence(f.database, f.householdId, randomUUID(), {}),
        /not found/
      )
      await generateOccurrences(f.database, f.householdId, f.ruleId, '2026-01-01', '2026-01-31')
      const o = await f.database('occurrences').first()
      await assert.rejects(
        () =>
          confirmOccurrence(f.database, f.householdId, o.id, {}, 'manual', null, {
            baseRevision: 2,
          }),
        /Revision conflict/
      )
      await assert.rejects(
        () => confirmOccurrence(f.database, f.householdId, o.id, { actualDate: 'bad' }),
        /Invalid actual date/
      )
      await f.database('occurrences').where({ id: o.id }).update({ status: 'confirmed' })
      await assert.rejects(
        () => confirmOccurrence(f.database, f.householdId, o.id, {}),
        /without ledger entry/
      )
      await f.database('occurrences').where({ id: o.id }).update({ status: 'expected' })
      await f.database('ledger_entries').insert({
        id: randomUUID(),
        household_id: f.householdId,
        occurrence_id: o.id,
        entry_date: '2026-01-31',
        amount_cents: 100,
        kind: 'expense',
        revision: 1,
      })
      await assert.rejects(
        () => confirmOccurrence(f.database, f.householdId, o.id, {}),
        /already linked/
      )
      await f.database('ledger_entries').delete()
      await f.database('recurring_rules').delete()
      await assert.rejects(
        () => confirmOccurrence(f.database, f.householdId, o.id, {}),
        /Rule not found/
      )
    } finally {
      await f.database.destroy()
    }
  })
  test('review acceptance leaves unchanged ledger revision while corrections remain validated', async ({
    assert,
  }) => {
    const f = await fixture()
    try {
      await generateOccurrences(f.database, f.householdId, f.ruleId, '2026-01-01', '2026-01-31')
      const o = await f.database('occurrences').first()
      await confirmOccurrence(f.database, f.householdId, o.id, {}, 'automatic')
      await assert.rejects(
        () => confirmOccurrence(f.database, f.householdId, o.id, { actualDate: 'bad' }),
        /Invalid actual date/
      )
      const reviewed = await confirmOccurrence(f.database, f.householdId, o.id, {})
      assert.equal(reviewed.revision, 1)
      const stored = await f.database('occurrences').where({ id: o.id }).first()
      assert.equal(stored.needs_review, 0)
      assert.equal(stored.revision, 3)
      assert.lengthOf(await f.database('change_events').where({ entity_type: 'ledger_entry' }), 1)
    } finally {
      await f.database.destroy()
    }
  })
  test('range and worker boundaries reject invalid input and derive today from household time zone', async ({
    assert,
  }) => {
    const f = await fixture()
    try {
      await assert.rejects(
        () => autoConfirmOverdue(f.database, f.householdId, 'bad'),
        /Invalid today/
      )
      await assert.rejects(
        () => processOverdueHouseholds(f.database, 'bad'),
        /Invalid processing time/
      )
      await f.database('households').where({ id: f.householdId }).update({ time_zone: 'invalid' })
      await assert.rejects(
        () => processOverdueHouseholds(f.database, '2026-02-01T10:00:00Z'),
        /Invalid household time zone/
      )
      await f
        .database('households')
        .where({ id: f.householdId })
        .update({ time_zone: 'America/Toronto' })
      for (const [from, through] of [
        ['bad', '2026-02-01'],
        ['2026-01-01', 'bad'],
        ['2026-02-01', '2026-01-01'],
        ['2026-01-01', '2028-01-01'],
      ])
        await assert.rejects(
          () => listOccurrencesInRange(f.database, f.householdId, from, through),
          /Invalid date range/
        )
      const rows = await listOccurrencesInRange(
        f.database,
        f.householdId,
        '2026-01-01',
        '2026-01-31'
      )
      assert.lengthOf(rows, 1)
      assert.equal(rows[0].displayStatus, 'overdue')
    } finally {
      await f.database.destroy()
    }
  })
})
