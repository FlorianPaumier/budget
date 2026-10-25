import { randomUUID } from 'node:crypto'
import type { Knex } from 'knex'
import { DateTime } from 'luxon'
import { balancesAsOf } from './ledger.js'
import { generateOccurrences } from './recurrence_store.js'

type Database = Knex | Knex.Transaction
type MutationOptions = { id?: string; operationId?: string }

export async function getMonthlyPlan(db: Knex, householdId: string, selectedMonth: string) {
  checkMonth(selectedMonth)
  const start = DateTime.fromISO(`${selectedMonth}-01`, { zone: 'utc' })
  const from = start.startOf('month').toISODate()!
  const through = start.endOf('month').toISODate()!
  const rules = await db('recurring_rules')
    .where({ household_id: householdId, active: true })
    .whereNull('deleted_at')
    .select('id')
  for (const rule of rules) await generateOccurrences(db, householdId, rule.id, from, through)
  await carryMonthForward(db, householdId, selectedMonth)
  const totals = await plannedMoneyLeft(db, householdId, selectedMonth)
  const estimates = await db('monthly_estimates')
    .where({ household_id: householdId, month: selectedMonth })
    .whereNull('deleted_at')
    .orderBy('category_id')
  const target = await db('monthly_plans')
    .where({ household_id: householdId, month: selectedMonth })
    .first()
  return { totals, estimates, target }
}

function checkMonth(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Invalid month')
}

function checkAmount(amount: number | null) {
  if (amount !== null && (!Number.isSafeInteger(amount) || amount < 0))
    throw new Error('Invalid amount')
}

function checkOptions(options: MutationOptions) {
  if (
    options.id &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(options.id)
  )
    throw new Error('Invalid stable ID')
  if (options.operationId && (options.operationId.length > 100 || !options.operationId.trim()))
    throw new Error('Invalid operation ID')
}

async function recordEvent(
  db: Database,
  householdId: string,
  deviceId: string | null,
  type: string,
  id: string,
  before: number | null,
  after: number,
  operationId?: string
) {
  await db('change_events').insert({
    id: randomUUID(),
    household_id: householdId,
    device_id: deviceId,
    entity_type: type,
    entity_id: id,
    before_revision: before,
    after_revision: after,
    operation_id: operationId ?? null,
    created_at: new Date().toISOString(),
  })
}

export async function setEstimate(
  db: Knex,
  householdId: string,
  deviceId: string,
  categoryId: string,
  month: string,
  amountCents: number,
  expectedRevision?: number,
  options: MutationOptions = {}
) {
  checkMonth(month)
  checkAmount(amountCents)
  checkOptions(options)
  return db.transaction(async (trx) => {
    const category = await trx('categories')
      .where({ id: categoryId, household_id: householdId })
      .whereNull('deleted_at')
      .first()
    if (!category) throw new Error('Category not found')
    const current = await trx('monthly_estimates')
      .where({ household_id: householdId, category_id: categoryId, month })
      .first()
    if (current) {
      if (expectedRevision !== undefined && current.revision !== expectedRevision)
        throw new Error('Revision conflict')
      const revision = current.revision + 1
      await trx('monthly_estimates')
        .where({ id: current.id })
        .update({ amount_cents: amountCents, deleted_at: null, revision })
      await recordEvent(
        trx,
        householdId,
        deviceId,
        'monthly_estimate',
        current.id,
        current.revision,
        revision,
        options.operationId
      )
      return { ...current, amount_cents: amountCents, deleted_at: null, revision }
    }
    if (expectedRevision !== undefined && expectedRevision !== 0)
      throw new Error('Revision conflict')
    const estimate = {
      id: options.id ?? randomUUID(),
      household_id: householdId,
      category_id: categoryId,
      month,
      amount_cents: amountCents,
      revision: 1,
      deleted_at: null,
    }
    await trx('monthly_estimates').insert(estimate)
    await recordEvent(
      trx,
      householdId,
      deviceId,
      'monthly_estimate',
      estimate.id,
      null,
      1,
      options.operationId
    )
    return estimate
  })
}

export async function setSavingsTarget(
  db: Knex,
  householdId: string,
  deviceId: string,
  month: string,
  amountCents: number | null,
  expectedRevision?: number,
  options: MutationOptions = {}
) {
  checkMonth(month)
  checkAmount(amountCents)
  checkOptions(options)
  return db.transaction(async (trx) => {
    const current = await trx('monthly_plans').where({ household_id: householdId, month }).first()
    if (current) {
      if (expectedRevision !== undefined && current.revision !== expectedRevision)
        throw new Error('Revision conflict')
      const revision = current.revision + 1
      await trx('monthly_plans')
        .where({ id: current.id })
        .update({ savings_target_cents: amountCents, revision })
      await recordEvent(
        trx,
        householdId,
        deviceId,
        'monthly_plan',
        current.id,
        current.revision,
        revision,
        options.operationId
      )
      return { ...current, savings_target_cents: amountCents, revision }
    }
    if (expectedRevision !== undefined && expectedRevision !== 0)
      throw new Error('Revision conflict')
    const plan = {
      id: options.id ?? randomUUID(),
      household_id: householdId,
      month,
      savings_target_cents: amountCents,
      revision: 1,
    }
    await trx('monthly_plans').insert(plan)
    await recordEvent(
      trx,
      householdId,
      deviceId,
      'monthly_plan',
      plan.id,
      null,
      1,
      options.operationId
    )
    return plan
  })
}

export async function carryMonthForward(db: Knex, householdId: string, month: string) {
  checkMonth(month)
  return db.transaction(async (trx) => {
    const source = await trx('monthly_estimates')
      .where({ household_id: householdId })
      .where('month', '<', month)
      .whereNull('deleted_at')
      .orderBy('month', 'desc')
      .first()
    const previous = source
      ? await trx('monthly_estimates')
          .where({ household_id: householdId, month: source.month })
          .whereNull('deleted_at')
      : []
    for (const estimate of previous) {
      const category = await trx('categories')
        .where({ id: estimate.category_id, household_id: householdId, active: 1 })
        .whereNull('deleted_at')
        .first()
      if (!category) continue
      const existing = await trx('monthly_estimates')
        .where({ household_id: householdId, month, category_id: estimate.category_id })
        .first()
      if (existing) continue
      const id = randomUUID()
      await trx('monthly_estimates').insert({
        id,
        household_id: householdId,
        category_id: estimate.category_id,
        month,
        amount_cents: estimate.amount_cents,
        revision: 1,
        deleted_at: null,
      })
      await recordEvent(trx, householdId, null, 'monthly_estimate', id, null, 1)
    }
    const targetPlan = await trx('monthly_plans')
      .where({ household_id: householdId, month })
      .first()
    if (!targetPlan) {
      const sourcePlan = await trx('monthly_plans')
        .where({ household_id: householdId })
        .where('month', '<', month)
        .orderBy('month', 'desc')
        .first()
      if (sourcePlan) {
        const id = randomUUID()
        await trx('monthly_plans').insert({
          id,
          household_id: householdId,
          month,
          savings_target_cents: sourcePlan.savings_target_cents,
          revision: 1,
        })
        await recordEvent(trx, householdId, null, 'monthly_plan', id, null, 1)
      }
    }
  })
}

function previousMonths(month: string, count: number): string[] {
  const [year, number] = month.split('-').map(Number)
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, number - index - 2, 1))
    return date.toISOString().slice(0, 7)
  })
}

export async function medianSuggestion(
  db: Database,
  householdId: string,
  categoryId: string,
  month: string
): Promise<{ amountCents: number | null; sampleCount: number }> {
  checkMonth(month)
  const months = previousMonths(month, 5)
  const rows = await db('ledger_entries')
    .where({ household_id: householdId, category_id: categoryId })
    .whereNull('deleted_at')
    .whereIn('kind', ['expense', 'category_adjustment'])
    .where('entry_date', '>=', `${months[4]}-01`)
    .where('entry_date', '<', `${month}-01`)
  const totals = new Map<string, number>()
  for (const row of rows) {
    const key = String(row.entry_date).slice(0, 7)
    if (months.includes(key)) totals.set(key, (totals.get(key) ?? 0) + Number(row.amount_cents))
  }
  const values = [...totals.values()].sort((a, b) => a - b)
  if (!values.length) return { amountCents: null, sampleCount: 0 }
  const middle = Math.floor(values.length / 2)
  const amountCents =
    values.length % 2 ? values[middle] : Math.round((values[middle - 1] + values[middle]) / 2)
  return { amountCents, sampleCount: values.length }
}

export async function plannedMoneyLeft(db: Database, householdId: string, month: string) {
  checkMonth(month)
  const first = `${month}-01`
  const prior = new Date(`${first}T00:00:00Z`)
  prior.setUTCDate(prior.getUTCDate() - 1)
  const balances = await balancesAsOf(db, householdId, prior.toISOString().slice(0, 10))
  const opening = balances.spendableCents
  const occurrences = await db('occurrences as o')
    .join('recurring_rules as r', 'o.rule_id', 'r.id')
    .where('o.household_id', householdId)
    .whereNull('o.deleted_at')
    .where('o.expected_date', '>=', first)
    .where('o.expected_date', '<', `${month}-32`)
    .select('r.kind', 'o.expected_amount_cents')
  let income = 0
  let bills = 0
  for (const row of occurrences) {
    if (row.kind === 'income') income += Number(row.expected_amount_cents)
    else bills += Number(row.expected_amount_cents)
  }
  const estimates = await db('monthly_estimates')
    .where({ household_id: householdId, month })
    .whereNull('deleted_at')
  const estimateTotal = estimates.reduce((sum, row) => sum + Number(row.amount_cents), 0)
  const plan = await db('monthly_plans').where({ household_id: householdId, month }).first()
  const savingsTarget =
    plan?.savings_target_cents === null || plan?.savings_target_cents === undefined
      ? 0
      : Number(plan.savings_target_cents)
  return {
    openingSpendableCents: opening,
    expectedIncomeCents: income,
    expectedBillsCents: bills,
    estimateCents: estimateTotal,
    savingsTargetCents: savingsTarget,
    moneyLeftCents: opening + income - bills - estimateTotal - savingsTarget,
  }
}
