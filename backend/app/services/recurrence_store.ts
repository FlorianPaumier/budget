import { randomUUID } from 'node:crypto'
import type { Knex } from 'knex'
import { DateTime } from 'luxon'
import { datesForRule, type RecurrenceRule } from './recurrence.js'
import { householdDate } from './household_date.js'
import { ApiError } from '../exceptions/api_error.js'

function validateAmount(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error('Amount must be positive integer cents')
}

type MutationOptions = { id?: string; operationId?: string; baseRevision?: number }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
function validateOptions(options: MutationOptions) {
  if (options.id && !uuid.test(options.id)) throw new Error('Invalid stable ID')
  if (options.operationId && (options.operationId.length > 100 || !options.operationId.trim()))
    throw new Error('Invalid operation ID')
  if (
    options.baseRevision !== undefined &&
    (!Number.isSafeInteger(options.baseRevision) || options.baseRevision < 1)
  )
    throw new Error('Invalid base revision')
}

async function requireHouseholdCategory(
  database: Knex,
  householdId: string,
  categoryId: string | null | undefined
) {
  if (!categoryId) return
  const category = await database('categories')
    .where({ id: categoryId, household_id: householdId })
    .whereNull('deleted_at')
    .first()
  if (!category) throw new ApiError('Category not found', 404, 'CATEGORY_NOT_FOUND')
}

async function recordChange(
  database: Knex,
  householdId: string,
  deviceId: string | null,
  entityType: string,
  entityId: string,
  beforeRevision: number | null,
  afterRevision: number | null,
  operationId?: string,
  snapshots?: { before?: unknown; after?: unknown }
) {
  await database('change_events').insert({
    id: randomUUID(),
    household_id: householdId,
    device_id: deviceId,
    entity_type: entityType,
    entity_id: entityId,
    before_revision: beforeRevision,
    after_revision: afterRevision,
    operation_id: operationId ?? null,
    before_value: snapshots?.before ? JSON.stringify(snapshots.before) : null,
    after_value: snapshots?.after ? JSON.stringify(snapshots.after) : null,
    created_at: new Date().toISOString(),
  })
}

export type RecurringRuleInput = {
  kind: 'income' | 'bill' | 'subscription'
  name: string
  categoryId: string | null
  amountCents: number
  frequency: RecurrenceRule['frequency']
  interval: number
  startsOn: string
  endsOn: string | null
  scheduleDetails?: RecurrenceRule['scheduleDetails']
}

export async function listRecurringRules(database: Knex, householdId: string) {
  return database('recurring_rules')
    .where({ household_id: householdId })
    .whereNull('deleted_at')
    .orderBy('name')
}

export async function getRecurringRule(database: Knex, householdId: string, id: string) {
  const rule = await database('recurring_rules')
    .where({ id, household_id: householdId })
    .whereNull('deleted_at')
    .first()
  if (!rule) throw new Error('Rule not found')
  return rule
}

export async function createRecurringRule(
  database: Knex,
  householdId: string,
  input: RecurringRuleInput,
  deviceId: string | null = null,
  options: MutationOptions = {}
) {
  validateOptions(options)
  validateAmount(input.amountCents)
  if (
    !['income', 'bill', 'subscription'].includes(input.kind) ||
    !input.name.trim() ||
    input.name.length > 160
  )
    throw new Error('Invalid rule')
  datesForRule(
    {
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      frequency: input.frequency,
      interval: input.interval,
      scheduleDetails: input.scheduleDetails,
    },
    input.startsOn,
    input.startsOn
  )
  const rule = {
    id: options.id ?? randomUUID(),
    household_id: householdId,
    kind: input.kind,
    name: input.name.trim(),
    category_id: input.categoryId,
    amount_cents: input.amountCents,
    frequency: input.frequency,
    interval: input.interval,
    starts_on: input.startsOn,
    ends_on: input.endsOn,
    schedule_details: input.scheduleDetails ? JSON.stringify(input.scheduleDetails) : null,
    active: true,
    revision: 1,
  }
  await database.transaction(async (trx) => {
    await requireHouseholdCategory(trx, householdId, input.categoryId)
    await trx('recurring_rules').insert(rule)
    await recordChange(
      trx,
      householdId,
      deviceId,
      'recurring_rule',
      rule.id,
      null,
      1,
      options.operationId
    )
  })
  return rule
}

export async function updateRecurringRule(
  database: Knex,
  householdId: string,
  ruleId: string,
  changes: Partial<RecurringRuleInput> & { active?: boolean },
  from: string,
  through: string,
  deviceId: string | null = null,
  options: MutationOptions = {}
) {
  validateOptions(options)
  return database.transaction(async (trx) => {
    const current = await trx('recurring_rules')
      .where({ id: ruleId, household_id: householdId })
      .whereNull('deleted_at')
      .first()
    if (!current) throw new Error('Rule not found')
    if (options.baseRevision !== undefined && current.revision !== options.baseRevision)
      throw new Error('Revision conflict')
    const next = {
      kind: changes.kind ?? current.kind,
      name: changes.name ?? current.name,
      categoryId: changes.categoryId === undefined ? current.category_id : changes.categoryId,
      amountCents: changes.amountCents ?? current.amount_cents,
      frequency: changes.frequency ?? current.frequency,
      interval: changes.interval ?? current.interval,
      startsOn: changes.startsOn ?? current.starts_on,
      endsOn: changes.endsOn === undefined ? current.ends_on : changes.endsOn,
      scheduleDetails:
        changes.scheduleDetails === undefined
          ? current.schedule_details
            ? JSON.parse(current.schedule_details)
            : null
          : changes.scheduleDetails,
    } as RecurringRuleInput
    validateAmount(next.amountCents)
    if (
      !['income', 'bill', 'subscription'].includes(next.kind) ||
      !next.name.trim() ||
      next.name.length > 160
    )
      throw new Error('Invalid rule')
    datesForRule(next, next.startsOn, next.startsOn)
    await requireHouseholdCategory(trx, householdId, next.categoryId)
    await trx('recurring_rules')
      .where({ id: ruleId })
      .update({
        kind: next.kind,
        name: next.name.trim(),
        category_id: next.categoryId,
        amount_cents: next.amountCents,
        frequency: next.frequency,
        interval: next.interval,
        starts_on: next.startsOn,
        ends_on: next.endsOn,
        schedule_details: next.scheduleDetails ? JSON.stringify(next.scheduleDetails) : null,
        active: changes.active ?? current.active,
        revision: current.revision + 1,
      })
    await recordChange(
      trx,
      householdId,
      deviceId,
      'recurring_rule',
      ruleId,
      current.revision,
      current.revision + 1,
      options.operationId
    )
    await refreshOccurrences(trx, householdId, ruleId, from, through)
    return { id: ruleId, revision: current.revision + 1 }
  })
}

export async function deleteRecurringRule(
  database: Knex,
  householdId: string,
  ruleId: string,
  from: string,
  through: string,
  deviceId: string | null = null,
  options: MutationOptions = {}
) {
  validateOptions(options)
  if (through < from) throw new Error('Invalid date range')
  return database.transaction(async (trx) => {
    const current = await trx('recurring_rules')
      .where({ id: ruleId, household_id: householdId })
      .whereNull('deleted_at')
      .first()
    if (!current) throw new Error('Rule not found')
    if (options.baseRevision !== undefined && current.revision !== options.baseRevision)
      throw new Error('Revision conflict')
    const revision = current.revision + 1
    await trx('recurring_rules')
      .where({ id: ruleId })
      .update({ active: false, deleted_at: new Date().toISOString(), revision })
    await recordChange(
      trx,
      householdId,
      deviceId,
      'recurring_rule',
      ruleId,
      current.revision,
      revision,
      options.operationId
    )
    const pending = await trx('occurrences')
      .where({ household_id: householdId, rule_id: ruleId, status: 'expected' })
      .whereNull('deleted_at')
      .where('expected_date', '>=', from)
      .select('id', 'revision')
    await trx('occurrences')
      .whereIn(
        'id',
        pending.map((row) => row.id)
      )
      .delete()
    for (const row of pending)
      await recordChange(trx, householdId, null, 'occurrence', row.id, row.revision, null)
    return { id: ruleId, revision }
  })
}

export async function generateOccurrences(
  database: Knex,
  householdId: string,
  ruleId: string,
  from: string,
  through: string
) {
  return database.transaction(async (trx) => {
    const rule = await trx('recurring_rules')
      .where({ id: ruleId, household_id: householdId })
      .first()
    if (!rule) throw new Error('Rule not found')
    if (!rule.active) return []
    validateAmount(rule.amount_cents)
    const details = rule.schedule_details ? JSON.parse(rule.schedule_details) : null
    const dates = datesForRule(
      {
        startsOn: rule.starts_on,
        endsOn: rule.ends_on,
        frequency: rule.frequency,
        interval: rule.interval,
        scheduleDetails: details,
      } as RecurrenceRule,
      from,
      through
    )
    for (const expectedDate of dates) {
      const id = randomUUID()
      const inserted = await trx('occurrences')
        .insert({
          id,
          household_id: householdId,
          rule_id: ruleId,
          expected_date: expectedDate,
          expected_amount_cents: rule.amount_cents,
          status: 'expected',
          needs_review: false,
          revision: 1,
        })
        .onConflict(['rule_id', 'expected_date'])
        .ignore()
        .returning('id')
      if (inserted.length) await recordChange(trx, householdId, null, 'occurrence', id, null, 1)
    }
    return dates
  })
}

export async function refreshOccurrences(
  database: Knex,
  householdId: string,
  ruleId: string,
  from: string,
  through: string
) {
  return database.transaction(async (trx) => {
    const stale = await trx('occurrences')
      .where({ household_id: householdId, rule_id: ruleId, status: 'expected' })
      .whereNull('deleted_at')
      .whereBetween('expected_date', [from, through])
      .select('id', 'revision')
    await trx('occurrences')
      .whereIn(
        'id',
        stale.map((row) => row.id)
      )
      .delete()
    for (const row of stale)
      await recordChange(trx, householdId, null, 'occurrence', row.id, row.revision, null)
    return generateOccurrences(trx, householdId, ruleId, from, through)
  })
}

export async function confirmOccurrence(
  database: Knex,
  householdId: string,
  occurrenceId: string,
  changes: { actualDate?: string; actualAmountCents?: number },
  method: 'manual' | 'automatic' = 'manual',
  deviceId: string | null = null,
  options: MutationOptions = {}
) {
  validateOptions(options)
  return database.transaction(async (trx) => {
    const occurrence = await trx('occurrences')
      .where({ id: occurrenceId, household_id: householdId })
      .whereNull('deleted_at')
      .first()
    if (!occurrence) throw new Error('Occurrence not found')
    if (options.baseRevision !== undefined && occurrence.revision !== options.baseRevision)
      throw new Error('Revision conflict')
    const existing = await trx('ledger_entries').where({ occurrence_id: occurrenceId }).first()
    if (occurrence.status === 'confirmed') {
      if (!existing) throw new Error('Occurrence already confirmed without ledger entry')
      const correctedDate = changes.actualDate ?? occurrence.actual_date
      const correctedAmount = changes.actualAmountCents ?? occurrence.actual_amount_cents
      if (!DateTime.fromISO(correctedDate, { zone: 'utc' }).isValid)
        throw new Error('Invalid actual date')
      validateAmount(correctedAmount)
      const changed =
        correctedDate !== existing.entry_date || correctedAmount !== existing.amount_cents
      if (!changed && !occurrence.needs_review) return existing
      if (changed) {
        await trx('ledger_entries')
          .where({ id: existing.id })
          .update({
            entry_date: correctedDate,
            amount_cents: correctedAmount,
            revision: existing.revision + 1,
          })
        const updated = await trx('ledger_entries').where({ id: existing.id }).first()
        await recordChange(
          trx,
          householdId,
          deviceId,
          'ledger_entry',
          existing.id,
          existing.revision,
          existing.revision + 1,
          undefined,
          { before: existing, after: updated }
        )
      }
      await trx('occurrences')
        .where({ id: occurrenceId })
        .update({
          actual_date: correctedDate,
          actual_amount_cents: correctedAmount,
          confirmation_method: method,
          needs_review: false,
          revision: occurrence.revision + 1,
        })
      await recordChange(
        trx,
        householdId,
        deviceId,
        'occurrence',
        occurrenceId,
        occurrence.revision,
        occurrence.revision + 1,
        options.operationId
      )
      return {
        ...existing,
        entry_date: correctedDate,
        amount_cents: correctedAmount,
        revision: existing.revision + (changed ? 1 : 0),
      }
    }
    const rule = await trx('recurring_rules')
      .where({ id: occurrence.rule_id, household_id: householdId })
      .first()
    if (!rule) throw new Error('Rule not found')
    const actualDate = changes.actualDate ?? occurrence.expected_date
    if (!DateTime.fromISO(actualDate, { zone: 'utc' }).isValid)
      throw new Error('Invalid actual date')
    const amount = changes.actualAmountCents ?? occurrence.expected_amount_cents
    validateAmount(amount)
    if (existing) throw new Error('Occurrence already linked to ledger entry')
    const entry = {
      id: randomUUID(),
      household_id: householdId,
      occurrence_id: occurrenceId,
      category_id: rule.category_id,
      entry_date: actualDate,
      kind: rule.kind === 'income' ? 'income' : 'expense',
      amount_cents: amount,
      note: rule.name,
      revision: 1,
    }
    await trx('ledger_entries').insert(entry)
    const inserted = await trx('ledger_entries').where({ id: entry.id }).first()
    await recordChange(trx, householdId, deviceId, 'ledger_entry', entry.id, null, 1, undefined, {
      after: inserted,
    })
    await trx('occurrences')
      .where({ id: occurrenceId })
      .update({
        status: 'confirmed',
        actual_date: actualDate,
        actual_amount_cents: amount,
        confirmation_method: method,
        needs_review: method === 'automatic',
        revision: occurrence.revision + 1,
      })
    await recordChange(
      trx,
      householdId,
      deviceId,
      'occurrence',
      occurrenceId,
      occurrence.revision,
      occurrence.revision + 1,
      options.operationId
    )
    return entry
  })
}

export async function autoConfirmOverdue(database: Knex, householdId: string, today: string) {
  const cutoff = DateTime.fromISO(today, { zone: 'utc' }).minus({ days: 2 }).toISODate()
  if (!cutoff) throw new Error('Invalid today')
  const rows = await database('occurrences as o')
    .join('recurring_rules as r', 'r.id', 'o.rule_id')
    .where('o.household_id', householdId)
    .where('o.status', 'expected')
    .whereNull('o.deleted_at')
    .whereIn('r.kind', ['bill', 'subscription'])
    .where('o.expected_date', '<=', cutoff)
    .select('o.id')
  for (const row of rows) await confirmOccurrence(database, householdId, row.id, {}, 'automatic')
  return rows.length
}

export async function processOverdueHouseholds(database: Knex, now: string) {
  const instant = DateTime.fromISO(now, { setZone: true })
  if (!instant.isValid) throw new Error('Invalid processing time')
  const households = await database('households').select('id', 'time_zone')
  let count = 0
  for (const household of households) {
    const today = instant.setZone(household.time_zone).toISODate()
    if (!today) throw new Error('Invalid household time zone')
    const rules = await database('recurring_rules')
      .where({ household_id: household.id, active: true })
      .whereNull('deleted_at')
      .select('id', 'starts_on')
    for (const rule of rules)
      await generateOccurrences(database, household.id, rule.id, rule.starts_on, today)
    count += await autoConfirmOverdue(database, household.id, today)
  }
  return count
}

export async function listOccurrences(database: Knex, householdId: string, today: string) {
  const rows = await database('occurrences as o')
    .join('recurring_rules as r', 'r.id', 'o.rule_id')
    .where('o.household_id', householdId)
    .whereNull('o.deleted_at')
    .orderBy('o.expected_date')
    .select('o.*', 'r.name as ruleName', 'r.kind as ruleKind')
  return rows.map((row) => ({
    ...row,
    displayStatus:
      row.status === 'confirmed'
        ? 'confirmed'
        : row.expected_date < today
          ? 'overdue'
          : row.expected_date === today
            ? 'due'
            : 'upcoming',
  }))
}

export async function listOccurrencesInRange(
  database: Knex,
  householdId: string,
  from: string,
  through: string,
  requestedToday?: string
) {
  const start = DateTime.fromISO(from, { zone: 'utc' })
  const end = DateTime.fromISO(through, { zone: 'utc' })
  if (!start.isValid || !end.isValid || start > end || end.diff(start, 'days').days > 366)
    throw new ApiError('Invalid date range', 422, 'VALIDATION_ERROR')
  const household = await database('households').where({ id: householdId }).first()
  const today = requestedToday ?? householdDate(new Date(), household.time_zone)
  const rules = await database('recurring_rules')
    .where({ household_id: householdId, active: true })
    .whereNull('deleted_at')
    .select('id')
  for (const rule of rules) await generateOccurrences(database, householdId, rule.id, from, through)
  const rows = await listOccurrences(database, householdId, today)
  return rows.filter((row) => row.expected_date >= from && row.expected_date <= through)
}
