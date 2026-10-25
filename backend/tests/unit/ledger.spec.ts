import { test } from '@japa/runner'
import knex from 'knex'
import { randomUUID } from 'node:crypto'
import {
  createCategory,
  updateCategory,
  deleteCategory,
  createEntry,
  updateEntry,
  deleteEntry,
  balancesAsOf,
  monthActuals,
} from '../../app/services/ledger.js'

async function fixture() {
  const database = knex({
    client: 'better-sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true,
  })
  await database.schema.createTable('households', (t) => {
    t.string('id').primary()
    t.integer('opening_spendable_cents')
    t.integer('opening_savings_cents')
    t.string('opening_date')
  })
  await database.schema.createTable('categories', (t) => {
    t.string('id').primary()
    t.string('household_id')
    t.string('name')
    t.boolean('active')
    t.integer('revision')
    t.string('deleted_at')
  })
  await database.schema.createTable('ledger_entries', (t) => {
    t.string('id').primary()
    t.string('household_id')
    t.string('category_id')
    t.string('occurrence_id')
    t.string('entry_date')
    t.string('kind')
    t.integer('amount_cents')
    t.string('account')
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
    t.text('before_value')
    t.text('after_value')
    t.string('created_at')
  })
  const householdId = randomUUID()
  const otherHouseholdId = randomUUID()
  const deviceId = randomUUID()
  for (const id of [householdId, otherHouseholdId]) {
    await database('households').insert({
      id,
      opening_spendable_cents: 100000,
      opening_savings_cents: 50000,
      opening_date: '2026-01-01',
    })
  }
  return { database, householdId, otherHouseholdId, deviceId }
}

test.group('manual ledger', () => {
  test('categories can be edited and deleted without losing prior entries', async ({ assert }) => {
    const f = await fixture()
    try {
      const category = await createCategory(f.database, f.householdId, f.deviceId, 'Food')
      const entry = await createEntry(f.database, f.householdId, f.deviceId, {
        kind: 'expense',
        entryDate: '2026-01-10',
        amountCents: 2000,
        categoryId: category.id,
      })
      const edited = await updateCategory(f.database, f.householdId, f.deviceId, category.id, {
        name: 'Groceries',
      })
      await deleteCategory(f.database, f.householdId, f.deviceId, category.id)
      assert.equal(edited.revision, 2)
      assert.equal(
        (await f
          .database('categories')
          .where({ id: category.id })
          .first()
          .then((result) => result.deleted_at)) !== null,
        true
      )
      assert.equal(
        await f
          .database('ledger_entries')
          .where({ id: entry.id })
          .first()
          .then((result) => result.category_id),
        category.id
      )
      assert.equal(
        await f
          .database('change_events')
          .where({ entity_id: category.id })
          .then((result) => result.length),
        3
      )
    } finally {
      await f.database.destroy()
    }
  })

  test('income, expenses, adjustments and transfers calculate two balances without changing total on transfer', async ({
    assert,
  }) => {
    const f = await fixture()
    try {
      await createEntry(f.database, f.householdId, f.deviceId, {
        kind: 'income',
        entryDate: '2026-01-02',
        amountCents: 10000,
      })
      await createEntry(f.database, f.householdId, f.deviceId, {
        kind: 'expense',
        entryDate: '2026-01-03',
        amountCents: 3000,
      })
      await createEntry(f.database, f.householdId, f.deviceId, {
        kind: 'category_adjustment',
        entryDate: '2026-01-04',
        amountCents: 2000,
      })
      await createEntry(f.database, f.householdId, f.deviceId, {
        kind: 'savings_transfer',
        entryDate: '2026-01-05',
        amountCents: 5000,
      })
      assert.deepEqual(await balancesAsOf(f.database, f.householdId, '2026-01-05'), {
        spendableCents: 100000,
        savingsCents: 55000,
        combinedCents: 155000,
      })
      await createEntry(f.database, f.householdId, f.deviceId, {
        kind: 'savings_transfer',
        entryDate: '2026-01-06',
        amountCents: -2000,
      })
      assert.deepEqual(await balancesAsOf(f.database, f.householdId, '2026-01-06'), {
        spendableCents: 102000,
        savingsCents: 53000,
        combinedCents: 155000,
      })
    } finally {
      await f.database.destroy()
    }
  })

  test('opening balance corrections affect only their selected account', async ({ assert }) => {
    const f = await fixture()
    try {
      await createEntry(f.database, f.householdId, f.deviceId, {
        kind: 'balance_adjustment',
        entryDate: '2026-01-01',
        amountCents: -1000,
        account: 'savings',
      })
      assert.deepEqual(await balancesAsOf(f.database, f.householdId, '2026-01-01'), {
        spendableCents: 100000,
        savingsCents: 49000,
        combinedCents: 149000,
      })
    } finally {
      await f.database.destroy()
    }
  })

  test('editing and deleting prior months recalculates current balance while preserving history', async ({
    assert,
  }) => {
    const f = await fixture()
    try {
      const entry = await createEntry(f.database, f.householdId, f.deviceId, {
        kind: 'expense',
        entryDate: '2026-01-15',
        amountCents: 1000,
      })
      const edited = await updateEntry(
        f.database,
        f.householdId,
        f.deviceId,
        entry.id,
        { amountCents: 2500 },
        1
      )
      assert.equal(edited.revision, 2)
      assert.equal(
        await balancesAsOf(f.database, f.householdId, '2026-02-10').then(
          (result) => result.spendableCents
        ),
        97500
      )
      await deleteEntry(f.database, f.householdId, f.deviceId, entry.id, 2)
      assert.equal(
        await balancesAsOf(f.database, f.householdId, '2026-02-10').then(
          (result) => result.spendableCents
        ),
        100000
      )
      assert.deepEqual(
        await f
          .database('change_events')
          .where({ entity_id: entry.id })
          .orderBy('created_at')
          .then((result) => result.map((e) => [e.before_revision, e.after_revision])),
        [
          [null, 1],
          [1, 2],
          [2, 3],
        ]
      )
    } finally {
      await f.database.destroy()
    }
  })

  test('today balance excludes future entries and month actuals include only that month', async ({
    assert,
  }) => {
    const f = await fixture()
    try {
      await createEntry(f.database, f.householdId, f.deviceId, {
        kind: 'income',
        entryDate: '2026-01-31',
        amountCents: 10000,
      })
      await createEntry(f.database, f.householdId, f.deviceId, {
        kind: 'expense',
        entryDate: '2026-02-05',
        amountCents: 3000,
      })
      await createEntry(f.database, f.householdId, f.deviceId, {
        kind: 'income',
        entryDate: '2026-02-20',
        amountCents: 7000,
      })
      assert.equal(
        await balancesAsOf(f.database, f.householdId, '2026-02-10').then(
          (result) => result.spendableCents
        ),
        107000
      )
      assert.deepEqual(await monthActuals(f.database, f.householdId, '2026-02', '2026-02-10'), {
        incomeCents: 0,
        spendingCents: 3000,
        transferToSavingsCents: 0,
        moneyLeftTodayCents: 107000,
      })
    } finally {
      await f.database.destroy()
    }
  })

  test('rejects invalid money and another household’s entry', async ({ assert }) => {
    const f = await fixture()
    try {
      await assert.rejects(
        () =>
          createEntry(f.database, f.householdId, f.deviceId, {
            kind: 'expense',
            entryDate: '2026-02-01',
            amountCents: 1.5,
          }),
        /safe integer/
      )
      const entry = await createEntry(f.database, f.householdId, f.deviceId, {
        kind: 'expense',
        entryDate: '2026-02-01',
        amountCents: 100,
      })
      await assert.rejects(
        () =>
          updateEntry(
            f.database,
            f.otherHouseholdId,
            f.deviceId,
            entry.id,
            { amountCents: 200 },
            1
          ),
        /not found/
      )
    } finally {
      await f.database.destroy()
    }
  })

  test('preserves client IDs and operation IDs for offline sync history', async ({ assert }) => {
    const f = await fixture()
    try {
      const categoryId = randomUUID()
      const entryId = randomUUID()
      const operationId = randomUUID()
      const category = await createCategory(f.database, f.householdId, f.deviceId, 'Food', {
        id: categoryId,
      })
      const entry = await createEntry(
        f.database,
        f.householdId,
        f.deviceId,
        { kind: 'expense', entryDate: '2026-02-01', amountCents: 100, categoryId },
        { id: entryId, operationId }
      )
      assert.equal(category.id, categoryId)
      assert.equal(entry.id, entryId)
      assert.equal(
        await f
          .database('change_events')
          .where({ entity_id: entryId })
          .first()
          .then((result) => result.operation_id),
        operationId
      )
    } finally {
      await f.database.destroy()
    }
  })
})
