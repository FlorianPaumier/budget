import { test } from '@japa/runner'
import knex from 'knex'
import { randomUUID } from 'node:crypto'
import {
  setEstimate,
  setSavingsTarget,
  carryMonthForward,
  medianSuggestion,
  plannedMoneyLeft,
} from '../../app/services/monthly_planning.js'

async function fixture() {
  const db = knex({
    client: 'better-sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true,
  })
  await db.schema.createTable('households', (t) => {
    t.string('id').primary()
    t.integer('opening_spendable_cents')
    t.integer('opening_savings_cents')
    t.string('opening_date')
  })
  await db.schema.createTable('categories', (t) => {
    t.string('id').primary()
    t.string('household_id')
    t.string('name')
    t.boolean('active')
    t.string('deleted_at')
  })
  await db.schema.createTable('monthly_estimates', (t) => {
    t.string('id').primary()
    t.string('household_id')
    t.string('category_id')
    t.string('month')
    t.integer('amount_cents')
    t.integer('revision')
    t.string('deleted_at')
    t.unique(['category_id', 'month'])
  })
  await db.schema.createTable('monthly_plans', (t) => {
    t.string('id').primary()
    t.string('household_id')
    t.string('month')
    t.integer('savings_target_cents')
    t.integer('revision')
    t.unique(['household_id', 'month'])
  })
  await db.schema.createTable('change_events', (t) => {
    t.string('id').primary()
    t.string('household_id')
    t.string('device_id')
    t.string('entity_type')
    t.string('entity_id')
    t.integer('before_revision')
    t.integer('after_revision')
    t.string('operation_id')
    t.string('created_at')
  })
  await db.schema.createTable('ledger_entries', (t) => {
    t.string('id').primary()
    t.string('household_id')
    t.string('category_id')
    t.string('entry_date')
    t.string('kind')
    t.integer('amount_cents')
    t.string('account')
    t.string('deleted_at')
  })
  await db.schema.createTable('recurring_rules', (t) => {
    t.string('id').primary()
    t.string('kind')
  })
  await db.schema.createTable('occurrences', (t) => {
    t.string('id').primary()
    t.string('household_id')
    t.string('rule_id')
    t.string('expected_date')
    t.integer('expected_amount_cents')
    t.string('deleted_at')
  })
  const householdId = randomUUID()
  const deviceId = randomUUID()
  const foodId = randomUUID()
  await db('households').insert({
    id: householdId,
    opening_spendable_cents: 100000,
    opening_savings_cents: 0,
    opening_date: '2026-01-01',
  })
  await db('categories').insert({
    id: foodId,
    household_id: householdId,
    name: 'Food',
    active: 1,
    deleted_at: null,
  })
  return { db, householdId, deviceId, foodId }
}

test.group('monthly planning', () => {
  test('stores editable estimates and optional savings target with change history', async ({
    assert,
  }) => {
    const f = await fixture()
    try {
      const first = await setEstimate(f.db, f.householdId, f.deviceId, f.foodId, '2026-10', 35000)
      const edited = await setEstimate(
        f.db,
        f.householdId,
        f.deviceId,
        f.foodId,
        '2026-10',
        40000,
        1
      )
      await setSavingsTarget(f.db, f.householdId, f.deviceId, '2026-10', 10000)
      assert.equal(first.revision, 1)
      assert.equal(edited.revision, 2)
      assert.equal(
        await f
          .db('change_events')
          .where({ entity_id: edited.id })
          .then((result) => result.length),
        2
      )
      assert.equal(
        await f
          .db('change_events')
          .where({ entity_type: 'monthly_plan' })
          .then((result) => result.length),
        1
      )
      await assert.rejects(
        () => setEstimate(f.db, f.householdId, f.deviceId, f.foodId, '2026-10', 1, 1),
        /Revision conflict/
      )
    } finally {
      await f.db.destroy()
    }
  })

  test('carries estimates into a new month without copying actual spending', async ({ assert }) => {
    const f = await fixture()
    try {
      await setEstimate(f.db, f.householdId, f.deviceId, f.foodId, '2026-09', 30000)
      await f.db('ledger_entries').insert({
        id: randomUUID(),
        household_id: f.householdId,
        category_id: f.foodId,
        entry_date: '2026-09-12',
        kind: 'expense',
        amount_cents: 40000,
      })
      await carryMonthForward(f.db, f.householdId, '2026-10')
      await carryMonthForward(f.db, f.householdId, '2026-10')
      assert.deepEqual(
        await f
          .db('monthly_estimates')
          .where({ month: '2026-10' })
          .then((result) => result.map((r) => r.amount_cents)),
        [30000]
      )
      assert.equal(await f.db('ledger_entries').then((result) => result.length), 1)
    } finally {
      await f.db.destroy()
    }
  })

  test('carries an optional savings target even when no category estimate exists', async ({
    assert,
  }) => {
    const f = await fixture()
    try {
      await setSavingsTarget(f.db, f.householdId, f.deviceId, '2026-09', 12000)
      await carryMonthForward(f.db, f.householdId, '2026-10')
      assert.equal(
        await f
          .db('monthly_plans')
          .where({ month: '2026-10' })
          .first()
          .then((result) => result.savings_target_cents),
        12000
      )
    } finally {
      await f.db.destroy()
    }
  })

  test('suggests median of up to five completed months, excluding missing months', async ({
    assert,
  }) => {
    const f = await fixture()
    try {
      for (const [month, amount] of [
        ['2026-04', 10000],
        ['2026-06', 30000],
        ['2026-07', 20000],
        ['2026-08', 40000],
        ['2026-09', 50000],
        ['2026-10', 99999],
      ] as const) {
        await f.db('ledger_entries').insert({
          id: randomUUID(),
          household_id: f.householdId,
          category_id: f.foodId,
          entry_date: `${month}-15`,
          kind: 'expense',
          amount_cents: amount,
        })
      }
      assert.deepEqual(await medianSuggestion(f.db, f.householdId, f.foodId, '2026-10'), {
        amountCents: 35000,
        sampleCount: 4,
      })
      assert.equal(await f.db('monthly_estimates').then((result) => result.length), 0)
    } finally {
      await f.db.destroy()
    }
  })

  test('planned money remains distinct from actual entries', async ({ assert }) => {
    const f = await fixture()
    try {
      await setEstimate(f.db, f.householdId, f.deviceId, f.foodId, '2026-10', 20000)
      await setSavingsTarget(f.db, f.householdId, f.deviceId, '2026-10', 5000)
      const incomeId = randomUUID()
      const billId = randomUUID()
      await f.db('recurring_rules').insert([
        { id: incomeId, kind: 'income' },
        { id: billId, kind: 'bill' },
      ])
      await f.db('occurrences').insert([
        {
          id: randomUUID(),
          household_id: f.householdId,
          rule_id: incomeId,
          expected_date: '2026-10-05',
          expected_amount_cents: 60000,
        },
        {
          id: randomUUID(),
          household_id: f.householdId,
          rule_id: billId,
          expected_date: '2026-10-10',
          expected_amount_cents: 10000,
        },
      ])
      await f.db('ledger_entries').insert({
        id: randomUUID(),
        household_id: f.householdId,
        entry_date: '2026-10-02',
        kind: 'expense',
        amount_cents: 7000,
      })
      assert.equal(
        await plannedMoneyLeft(f.db, f.householdId, '2026-10').then(
          (result) => result.moneyLeftCents
        ),
        125000
      )
    } finally {
      await f.db.destroy()
    }
  })
})
