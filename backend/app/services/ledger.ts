import { randomUUID } from 'node:crypto'
import type { Knex } from 'knex'

type Database = Knex | Knex.Transaction
export type EntryKind =
  'income' | 'expense' | 'category_adjustment' | 'savings_transfer' | 'balance_adjustment'
export type EntryInput = {
  kind: EntryKind
  entryDate: string
  amountCents: number
  categoryId?: string | null
  account?: 'spendable' | 'savings'
  note?: string | null
}
type MutationOptions = { id?: string; operationId?: string }

function validateOptions(options: MutationOptions) {
  if (
    options.id &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(options.id)
  )
    throw new Error('Invalid stable ID')
  if (options.operationId && (options.operationId.length > 100 || !options.operationId.trim()))
    throw new Error('Invalid operation ID')
}

function validDate(value: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ||
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value
  ) {
    throw new Error('Invalid entry date')
  }
}

function validAmount(kind: EntryKind, amount: number) {
  if (!Number.isSafeInteger(amount))
    throw new Error('Amount must be a safe integer number of cents')
  if (kind !== 'savings_transfer' && kind !== 'balance_adjustment' && amount < 0)
    throw new Error('Amount must be nonnegative')
  if (amount === 0) throw new Error('Amount must be nonzero')
}

async function event(
  trx: Database,
  householdId: string,
  deviceId: string,
  entityType: string,
  entityId: string,
  before: number | null,
  after: number,
  operationId?: string,
  beforeValue?: object | null,
  afterValue?: object | null
) {
  await trx('change_events').insert({
    id: randomUUID(),
    household_id: householdId,
    device_id: deviceId,
    entity_type: entityType,
    entity_id: entityId,
    before_revision: before,
    after_revision: after,
    operation_id: operationId ?? null,
    before_value: beforeValue ? JSON.stringify(beforeValue) : null,
    after_value: afterValue ? JSON.stringify(afterValue) : null,
    created_at: new Date().toISOString(),
  })
}

async function requireCategory(
  database: Database,
  householdId: string,
  id: string | null | undefined
) {
  if (!id) return
  const category = await database('categories')
    .where({ id, household_id: householdId })
    .whereNull('deleted_at')
    .first()
  if (!category) throw new Error('Category not found')
}

function normalizeName(name: string) {
  const trimmed = name.trim()
  if (!trimmed || trimmed.length > 120) throw new Error('Invalid category name')
  return trimmed
}

export async function createCategory(
  database: Knex,
  householdId: string,
  deviceId: string,
  name: string,
  options: MutationOptions = {}
) {
  validateOptions(options)
  const normalized = normalizeName(name)
  return database.transaction(async (trx) => {
    const category = {
      id: options.id ?? randomUUID(),
      household_id: householdId,
      name: normalized,
      active: true,
      revision: 1,
      deleted_at: null,
    }
    await trx('categories').insert(category)
    await event(trx, householdId, deviceId, 'category', category.id, null, 1, options.operationId)
    return category
  })
}

export async function updateCategory(
  database: Knex,
  householdId: string,
  deviceId: string,
  id: string,
  changes: { name?: string; active?: boolean },
  expectedRevision?: number,
  options: MutationOptions = {}
) {
  validateOptions(options)
  return database.transaction(async (trx) => {
    const current = await trx('categories')
      .where({ id, household_id: householdId })
      .whereNull('deleted_at')
      .first()
    if (!current) throw new Error('Category not found')
    if (expectedRevision !== undefined && current.revision !== expectedRevision)
      throw new Error('Revision conflict')
    const next = {
      name: changes.name === undefined ? current.name : normalizeName(changes.name),
      active: changes.active === undefined ? current.active : changes.active,
      revision: current.revision + 1,
    }
    await trx('categories').where({ id }).update(next)
    await event(
      trx,
      householdId,
      deviceId,
      'category',
      id,
      current.revision,
      next.revision,
      options.operationId
    )
    return { ...current, ...next }
  })
}

export async function deleteCategory(
  database: Knex,
  householdId: string,
  deviceId: string,
  id: string,
  expectedRevision?: number,
  options: MutationOptions = {}
) {
  validateOptions(options)
  return database.transaction(async (trx) => {
    const current = await trx('categories')
      .where({ id, household_id: householdId })
      .whereNull('deleted_at')
      .first()
    if (!current) throw new Error('Category not found')
    if (expectedRevision !== undefined && current.revision !== expectedRevision)
      throw new Error('Revision conflict')
    await trx('categories')
      .where({ id })
      .update({
        deleted_at: new Date().toISOString(),
        active: false,
        revision: current.revision + 1,
      })
    await event(
      trx,
      householdId,
      deviceId,
      'category',
      id,
      current.revision,
      current.revision + 1,
      options.operationId
    )
  })
}

function normalizeEntry(input: EntryInput) {
  if (
    ![
      'income',
      'expense',
      'category_adjustment',
      'savings_transfer',
      'balance_adjustment',
    ].includes(input.kind)
  )
    throw new Error('Invalid entry kind')
  validDate(input.entryDate)
  validAmount(input.kind, input.amountCents)
  if (
    input.kind === 'balance_adjustment' &&
    !['spendable', 'savings'].includes(input.account ?? '')
  )
    throw new Error('Account required for balance adjustment')
  if (input.kind !== 'balance_adjustment' && input.account)
    throw new Error('Account only allowed for balance adjustment')
  if (input.kind === 'savings_transfer' && input.categoryId)
    throw new Error('Transfer cannot have a category')
  if (input.note && input.note.length > 500) throw new Error('Note too long')
  return {
    kind: input.kind,
    entry_date: input.entryDate,
    amount_cents: input.amountCents,
    category_id: input.categoryId ?? null,
    account: input.account ?? null,
    note: input.note ?? null,
  }
}

export async function createEntry(
  database: Knex,
  householdId: string,
  deviceId: string,
  input: EntryInput,
  options: MutationOptions = {}
) {
  validateOptions(options)
  const normalized = normalizeEntry(input)
  return database.transaction(async (trx) => {
    await requireCategory(trx, householdId, normalized.category_id)
    const entry = {
      id: options.id ?? randomUUID(),
      household_id: householdId,
      occurrence_id: null,
      ...normalized,
      revision: 1,
      deleted_at: null,
    }
    await trx('ledger_entries').insert(entry)
    await event(
      trx,
      householdId,
      deviceId,
      'ledger_entry',
      entry.id,
      null,
      1,
      options.operationId,
      null,
      entry
    )
    return entry
  })
}

export async function updateEntry(
  database: Knex,
  householdId: string,
  deviceId: string,
  id: string,
  changes: Partial<EntryInput>,
  expectedRevision?: number,
  options: MutationOptions = {}
) {
  validateOptions(options)
  return database.transaction(async (trx) => {
    const current = await trx('ledger_entries')
      .where({ id, household_id: householdId })
      .whereNull('deleted_at')
      .first()
    if (!current) throw new Error('Entry not found')
    if (current.occurrence_id) throw new Error('Edit recurring entries through their occurrence')
    if (expectedRevision !== undefined && current.revision !== expectedRevision)
      throw new Error('Revision conflict')
    const normalized = normalizeEntry({
      kind: changes.kind ?? current.kind,
      entryDate: changes.entryDate ?? current.entry_date,
      amountCents: changes.amountCents ?? current.amount_cents,
      categoryId: changes.categoryId === undefined ? current.category_id : changes.categoryId,
      account: changes.account === undefined ? current.account : changes.account,
      note: changes.note === undefined ? current.note : changes.note,
    })
    await requireCategory(trx, householdId, normalized.category_id)
    const next = { ...normalized, revision: current.revision + 1 }
    await trx('ledger_entries').where({ id }).update(next)
    await event(
      trx,
      householdId,
      deviceId,
      'ledger_entry',
      id,
      current.revision,
      next.revision,
      options.operationId,
      current,
      { ...current, ...next }
    )
    return { ...current, ...next }
  })
}

export async function deleteEntry(
  database: Knex,
  householdId: string,
  deviceId: string,
  id: string,
  expectedRevision?: number,
  options: MutationOptions = {}
) {
  validateOptions(options)
  return database.transaction(async (trx) => {
    const current = await trx('ledger_entries')
      .where({ id, household_id: householdId })
      .whereNull('deleted_at')
      .first()
    if (!current) throw new Error('Entry not found')
    if (current.occurrence_id) throw new Error('Delete recurring entries through their occurrence')
    if (expectedRevision !== undefined && current.revision !== expectedRevision)
      throw new Error('Revision conflict')
    const deletedAt = new Date().toISOString()
    await trx('ledger_entries')
      .where({ id })
      .update({ deleted_at: deletedAt, revision: current.revision + 1 })
    await event(
      trx,
      householdId,
      deviceId,
      'ledger_entry',
      id,
      current.revision,
      current.revision + 1,
      options.operationId,
      current,
      { ...current, deleted_at: deletedAt, revision: current.revision + 1 }
    )
  })
}

export async function balancesAsOf(database: Database, householdId: string, asOfDate: string) {
  validDate(asOfDate)
  const household = await database('households').where({ id: householdId }).first()
  if (!household) throw new Error('Household not found')
  let spendable = Number(household.opening_spendable_cents)
  let savings = Number(household.opening_savings_cents)
  const entries = await database('ledger_entries')
    .where({ household_id: householdId })
    .whereNull('deleted_at')
    .where('entry_date', '<=', asOfDate)
  for (const entry of entries) {
    const amount = Number(entry.amount_cents)
    switch (entry.kind) {
      case 'income':
        spendable += amount
        break
      case 'expense':
      case 'category_adjustment':
        spendable -= amount
        break
      case 'savings_transfer':
        spendable -= amount
        savings += amount
        break
      case 'balance_adjustment':
        if (entry.account === 'savings') savings += amount
        else spendable += amount
        break
      default:
        throw new Error(`Unknown entry kind: ${entry.kind}`)
    }
  }
  if (![spendable, savings, spendable + savings].every(Number.isSafeInteger))
    throw new Error('Balance exceeds safe integer cents')
  return { spendableCents: spendable, savingsCents: savings, combinedCents: spendable + savings }
}

export async function monthActuals(
  database: Database,
  householdId: string,
  month: string,
  today: string
) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Invalid month')
  validDate(today)
  const entries = await database('ledger_entries')
    .where({ household_id: householdId })
    .whereNull('deleted_at')
    .where('entry_date', '>=', `${month}-01`)
    .where('entry_date', '<=', today)
    .where('entry_date', '<', `${month}-32`)
  let income = 0
  let spending = 0
  let transfer = 0
  for (const entry of entries) {
    const amount = Number(entry.amount_cents)
    if (entry.kind === 'income') income += amount
    else if (entry.kind === 'expense' || entry.kind === 'category_adjustment') spending += amount
    else if (entry.kind === 'savings_transfer') transfer += amount
  }
  const balances = await balancesAsOf(database, householdId, today)
  return {
    incomeCents: income,
    spendingCents: spending,
    transferToSavingsCents: transfer,
    moneyLeftTodayCents: balances.spendableCents,
  }
}
