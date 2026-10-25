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

import {
  setEstimate,
  setSavingsTarget,
  carryMonthForward,
  medianSuggestion,
} from '../../app/services/monthly_planning.js'
import { datesForRule, type RecurrenceRule } from '../../app/services/recurrence.js'
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
  await database.schema.createTable('monthly_estimates', (t) => {
    t.string('id').primary()
    t.string('household_id')
    t.string('category_id')
    t.string('month')
    t.integer('amount_cents')
    t.integer('revision')
    t.string('deleted_at')
  })
  await database.schema.createTable('monthly_plans', (t) => {
    t.string('id').primary()
    t.string('household_id')
    t.string('month')
    t.integer('savings_target_cents')
    t.integer('revision')
  })
  return { database, householdId, otherHouseholdId, deviceId }
}

test.group('domain boundary coverage', () => {
  test('rejects invalid ledger inputs and mutation metadata without storing entries', async ({
    assert,
  }) => {
    const f = await fixture()
    const input = { kind: 'expense' as const, entryDate: '2026-02-01', amountCents: 100 }
    try {
      const cases: [Record<string, unknown>, RegExp][] = [
        [{ kind: 'unknown' }, /Invalid entry kind/],
        [{ entryDate: 'bad' }, /Invalid entry date/],
        [{ entryDate: '2026-13-01' }, /Invalid entry date/],
        [{ entryDate: '2026-02-30' }, /Invalid entry date/],
        [{ amountCents: -1 }, /nonnegative/],
        [{ amountCents: 0 }, /nonzero/],
        [{ kind: 'balance_adjustment' }, /Account required/],
        [{ account: 'savings' }, /Account only/],
        [{ kind: 'savings_transfer', categoryId: randomUUID() }, /Transfer cannot/],
        [{ note: 'x'.repeat(501) }, /Note too long/],
        [{ categoryId: randomUUID() }, /Category not found/],
      ]
      for (const [changes, message] of cases)
        await assert.rejects(
          () =>
            createEntry(f.database, f.householdId, f.deviceId, {
              ...input,
              ...changes,
            } as Parameters<typeof createEntry>[3]),
          message
        )
      for (const options of [{ id: 'bad' }, { operationId: ' ' }, { operationId: 'x'.repeat(101) }])
        await assert.rejects(
          () => createEntry(f.database, f.householdId, f.deviceId, input, options),
          /Invalid/
        )
      for (const name of [' ', 'x'.repeat(121)])
        await assert.rejects(
          () => createCategory(f.database, f.householdId, f.deviceId, name),
          /Invalid category name/
        )
      assert.lengthOf(await f.database('ledger_entries'), 0)
    } finally {
      await f.database.destroy()
    }
  })
  test('category and entry revisions protect ownership and preserve explicit null edits', async ({
    assert,
  }) => {
    const f = await fixture()
    try {
      const c = await createCategory(f.database, f.householdId, f.deviceId, ' Food ')
      assert.equal(c.name, 'Food')
      await assert.rejects(
        () => updateCategory(f.database, f.otherHouseholdId, f.deviceId, c.id, {}),
        /not found/
      )
      await assert.rejects(
        () => updateCategory(f.database, f.householdId, f.deviceId, c.id, {}, 2),
        /Revision conflict/
      )
      const revised = await updateCategory(
        f.database,
        f.householdId,
        f.deviceId,
        c.id,
        { active: false },
        1
      )
      assert.equal(revised.name, 'Food')
      assert.isFalse(revised.active)
      await assert.rejects(
        () => deleteCategory(f.database, f.otherHouseholdId, f.deviceId, c.id),
        /not found/
      )
      await assert.rejects(
        () => deleteCategory(f.database, f.householdId, f.deviceId, c.id, 1),
        /Revision conflict/
      )
      const e = await createEntry(f.database, f.householdId, f.deviceId, {
        kind: 'expense',
        entryDate: '2026-01-01',
        amountCents: 100,
        categoryId: c.id,
        note: 'Dinner',
      })
      await assert.rejects(
        () => updateEntry(f.database, f.householdId, f.deviceId, e.id, {}, 2),
        /Revision conflict/
      )
      const edited = await updateEntry(
        f.database,
        f.householdId,
        f.deviceId,
        e.id,
        {
          kind: 'income',
          entryDate: '2026-02-02',
          categoryId: null,
          note: null,
          account: undefined,
        },
        1
      )
      assert.equal(edited.kind, 'income')
      assert.isNull(edited.category_id)
      assert.isNull(edited.note)
      await assert.rejects(
        () => deleteEntry(f.database, f.otherHouseholdId, f.deviceId, e.id),
        /not found/
      )
      await assert.rejects(
        () => deleteEntry(f.database, f.householdId, f.deviceId, e.id, 1),
        /Revision conflict/
      )
      await f.database('ledger_entries').where({ id: e.id }).update({ occurrence_id: randomUUID() })
      await assert.rejects(
        () => updateEntry(f.database, f.householdId, f.deviceId, e.id, {}),
        /through their occurrence/
      )
      await assert.rejects(
        () => deleteEntry(f.database, f.householdId, f.deviceId, e.id),
        /through their occurrence/
      )
    } finally {
      await f.database.destroy()
    }
  })
  test('balances handle spendable corrections and reject corrupt or overflowing stored data', async ({
    assert,
  }) => {
    const f = await fixture()
    try {
      await assert.rejects(
        () => balancesAsOf(f.database, randomUUID(), '2026-01-01'),
        /Household not found/
      )
      await assert.rejects(
        () => monthActuals(f.database, f.householdId, '2026-13', '2026-01-01'),
        /Invalid month/
      )
      const e = await createEntry(f.database, f.householdId, f.deviceId, {
        kind: 'balance_adjustment',
        account: 'spendable',
        entryDate: '2026-01-01',
        amountCents: 50,
      })
      assert.equal(
        await balancesAsOf(f.database, f.householdId, '2026-01-01').then(
          (value) => value.spendableCents
        ),
        100050
      )
      await f.database('ledger_entries').where({ id: e.id }).update({ kind: 'corrupt' })
      await assert.rejects(
        () => balancesAsOf(f.database, f.householdId, '2026-01-01'),
        /Unknown entry kind/
      )
      await f
        .database('ledger_entries')
        .where({ id: e.id })
        .update({ kind: 'income', amount_cents: Number.MAX_SAFE_INTEGER })
      await assert.rejects(
        () => balancesAsOf(f.database, f.householdId, '2026-01-01'),
        /exceeds safe integer/
      )
    } finally {
      await f.database.destroy()
    }
  })
  test('month totals separate income, category spending, savings and corrections', async ({
    assert,
  }) => {
    const f = await fixture()
    try {
      for (const input of [
        { kind: 'income' as const, amountCents: 1000 },
        { kind: 'category_adjustment' as const, amountCents: 100 },
        { kind: 'savings_transfer' as const, amountCents: 200 },
        { kind: 'balance_adjustment' as const, amountCents: 50, account: 'savings' as const },
      ])
        await createEntry(f.database, f.householdId, f.deviceId, {
          ...input,
          entryDate: '2026-01-01',
        })
      assert.deepEqual(await monthActuals(f.database, f.householdId, '2026-01', '2026-01-01'), {
        incomeCents: 1000,
        spendingCents: 100,
        transferToSavingsCents: 200,
        moneyLeftTodayCents: 100700,
      })
    } finally {
      await f.database.destroy()
    }
  })
  test('monthly planning validates revisions and does not overwrite explicit or inactive category estimates', async ({
    assert,
  }) => {
    const f = await fixture()
    try {
      const c = await createCategory(f.database, f.householdId, f.deviceId, 'Food')
      await assert.rejects(
        () => setEstimate(f.database, f.householdId, f.deviceId, c.id, '2026-13', 100),
        /Invalid month/
      )
      for (const amount of [-1, 0.5])
        await assert.rejects(
          () => setSavingsTarget(f.database, f.householdId, f.deviceId, '2026-01', amount),
          /Invalid amount/
        )
      for (const options of [{ id: 'bad' }, { operationId: ' ' }, { operationId: 'x'.repeat(101) }])
        await assert.rejects(
          () =>
            setEstimate(f.database, f.householdId, f.deviceId, c.id, '2026-01', 100, 0, options),
          /Invalid/
        )
      await assert.rejects(
        () => setEstimate(f.database, f.otherHouseholdId, f.deviceId, c.id, '2026-01', 100),
        /Category not found/
      )
      await assert.rejects(
        () => setEstimate(f.database, f.householdId, f.deviceId, c.id, '2026-01', 100, 1),
        /Revision conflict/
      )
      await assert.rejects(
        () => setSavingsTarget(f.database, f.householdId, f.deviceId, '2026-01', 100, 1),
        /Revision conflict/
      )
      await setEstimate(f.database, f.householdId, f.deviceId, c.id, '2026-01', 100, 0)
      await setSavingsTarget(f.database, f.householdId, f.deviceId, '2026-01', null, 0)
      await assert.rejects(
        () => setSavingsTarget(f.database, f.householdId, f.deviceId, '2026-01', 100, 0),
        /Revision conflict/
      )
      await assert.rejects(
        () => setEstimate(f.database, f.householdId, f.deviceId, c.id, '2026-01', 100, 0),
        /Revision conflict/
      )
      assert.equal(
        await setEstimate(f.database, f.householdId, f.deviceId, c.id, '2026-01', 200).then(
          (value) => value.revision
        ),
        2
      )
      await setSavingsTarget(f.database, f.householdId, f.deviceId, '2026-01', 500)
      await setEstimate(f.database, f.householdId, f.deviceId, c.id, '2026-02', 300)
      await carryMonthForward(f.database, f.householdId, '2026-02')
      assert.equal(
        await f
          .database('monthly_estimates')
          .where({ month: '2026-02' })
          .first()
          .then((value) => value.amount_cents),
        300
      )
      await updateCategory(f.database, f.householdId, f.deviceId, c.id, { active: false })
      await carryMonthForward(f.database, f.householdId, '2026-03')
      assert.lengthOf(await f.database('monthly_estimates').where({ month: '2026-03' }), 0)
      assert.deepEqual(await medianSuggestion(f.database, f.householdId, c.id, '2026-03'), {
        amountCents: null,
        sampleCount: 0,
      })
    } finally {
      await f.database.destroy()
    }
  })
  test('recurrence rejects invalid schedules and clips twice monthly dates to its start and end', ({
    assert,
  }) => {
    const rule: RecurrenceRule = { startsOn: '2026-01-01', frequency: 'daily', interval: 1 }
    for (const changes of [
      { frequency: 'unknown' },
      { interval: 0 },
      { interval: 1.5 },
      { startsOn: 'bad' },
      { endsOn: 'bad' },
    ])
      assert.throws(
        () => datesForRule({ ...rule, ...changes } as RecurrenceRule, '2026-01-01', '2026-01-31'),
        /Invalid/
      )
    for (const [from, through] of [
      ['bad', '2026-01-31'],
      ['2026-01-01', 'bad'],
      ['2026-02-01', '2026-01-31'],
    ])
      assert.throws(() => datesForRule(rule, from, through), /Invalid date range/)
    for (const days of [undefined, [1], [0, 32], [1.5, 15]])
      assert.throws(
        () =>
          datesForRule(
            {
              ...rule,
              frequency: 'twice_monthly',
              scheduleDetails: days ? { days: days as [number, number] } : null,
            },
            '2026-01-01',
            '2026-01-31'
          ),
        /Invalid twice-monthly/
      )
    assert.deepEqual(
      datesForRule(
        {
          ...rule,
          frequency: 'twice_monthly',
          startsOn: '2026-01-20',
          endsOn: '2026-02-15',
          scheduleDetails: { days: [15, 31] },
        },
        '2026-01-25',
        '2026-02-28'
      ),
      ['2026-01-31', '2026-02-15']
    )
  })
})
