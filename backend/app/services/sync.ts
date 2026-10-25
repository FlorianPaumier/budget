import { randomUUID } from 'node:crypto'
import type { Knex } from 'knex'
import { DateTime } from 'luxon'
import {
  createCategory,
  createEntry,
  deleteCategory,
  deleteEntry,
  updateCategory,
  updateEntry,
  type EntryInput,
} from './ledger.js'
import {
  createRecurringRule,
  updateRecurringRule,
  deleteRecurringRule,
  confirmOccurrence,
  type RecurringRuleInput,
} from './recurrence_store.js'
import { householdDate } from './household_date.js'
import { setEstimate, setSavingsTarget } from './monthly_planning.js'
import { ApiError } from '#exceptions/api_error'
import { setHouseholdReminder } from '#services/household_access'
import { householdResource } from '../serializers/access.js'

export type SyncOperation = {
  operationId: string
  entityType:
    | 'category'
    | 'ledger_entry'
    | 'recurring_rule'
    | 'occurrence'
    | 'monthly_estimate'
    | 'monthly_plan'
    | 'household'
  entityId: string
  action: 'create' | 'update' | 'delete'
  baseRevision: number
  value?: Record<string, unknown>
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const tables = {
  category: 'categories',
  ledger_entry: 'ledger_entries',
  recurring_rule: 'recurring_rules',
  occurrence: 'occurrences',
  monthly_estimate: 'monthly_estimates',
  monthly_plan: 'monthly_plans',
  household: 'households',
} as const
const feedTables: Record<string, string> = {
  ...tables,
  recurring_rule: 'recurring_rules',
  occurrence: 'occurrences',
  monthly_estimate: 'monthly_estimates',
  monthly_plan: 'monthly_plans',
}

function validate(operation: SyncOperation) {
  if (!operation || typeof operation !== 'object') throw new Error('Invalid operation')
  if (!uuid.test(operation.operationId) || !uuid.test(operation.entityId))
    throw new Error('Invalid operation ID')
  if (!(operation.entityType in tables)) throw new Error('Unsupported entity type')
  if (!['create', 'update', 'delete'].includes(operation.action)) throw new Error('Invalid action')
  if (!Number.isSafeInteger(operation.baseRevision) || operation.baseRevision < 0)
    throw new Error('Invalid base revision')
  if (operation.action === 'create' && operation.baseRevision !== 0)
    throw new Error('Create must start at revision zero')
  if (operation.action !== 'create' && operation.baseRevision < 1)
    throw new Error('Update requires a base revision')
  if (operation.entityType === 'occurrence' && operation.action !== 'update')
    throw new Error('Occurrences can only be confirmed')
  if (operation.entityType === 'household' && operation.action !== 'update')
    throw new Error('Household settings can only be updated')
  if (
    ['monthly_estimate', 'monthly_plan'].includes(operation.entityType) &&
    operation.action === 'delete'
  )
    throw new Error('Monthly plans cannot be deleted')
  if (
    operation.action !== 'delete' &&
    (!operation.value || typeof operation.value !== 'object' || Array.isArray(operation.value))
  )
    throw new Error('Value required')
}

function categoryValue(row: Record<string, any>) {
  return { name: row.name, active: Boolean(row.active) }
}

function entryValue(row: Record<string, any>) {
  return {
    kind: row.kind,
    entryDate: row.entry_date,
    amountCents: Number(row.amount_cents),
    categoryId: row.category_id,
    account: row.account,
    note: row.note,
    occurrenceId: row.occurrence_id,
  }
}

function feedValue(entityType: string, row: Record<string, any>) {
  switch (entityType) {
    case 'category':
      return categoryValue(row)
    case 'ledger_entry':
      return entryValue(row)
    case 'recurring_rule':
      return {
        kind: row.kind,
        name: row.name,
        categoryId: row.category_id,
        amountCents: Number(row.amount_cents),
        frequency: row.frequency,
        interval: row.interval,
        startsOn: row.starts_on,
        endsOn: row.ends_on,
        scheduleDetails: row.schedule_details ? JSON.parse(row.schedule_details) : null,
        active: Boolean(row.active),
      }
    case 'occurrence':
      return {
        ruleName: row.ruleName,
        ruleKind: row.ruleKind,
        ruleId: row.rule_id,
        expectedDate: row.expected_date,
        expectedAmountCents: Number(row.expected_amount_cents),
        status: row.status,
        actualDate: row.actual_date,
        actualAmountCents:
          row.actual_amount_cents === null ? null : Number(row.actual_amount_cents),
        confirmationMethod: row.confirmation_method,
        needsReview: Boolean(row.needs_review),
      }
    case 'monthly_estimate':
      return {
        categoryId: row.category_id,
        month: row.month,
        amountCents: Number(row.amount_cents),
      }
    case 'monthly_plan':
      return {
        month: row.month,
        savingsTargetCents:
          row.savings_target_cents === null ? null : Number(row.savings_target_cents),
      }
    case 'household':
      return householdResource(row)
    default:
      return null
  }
}

function snapshot(entityType: string, row: Record<string, any> | null) {
  if (!row) return null
  return {
    id: row.id,
    revision: row.revision,
    deletedAt: row.deleted_at ?? null,
    ...feedValue(entityType, row),
  }
}

async function currentForOperation(database: Knex, householdId: string, operation: SyncOperation) {
  const table = tables[operation.entityType]
  const byId = await database(table)
    .where(
      operation.entityType === 'household'
        ? { id: householdId }
        : { id: operation.entityId, household_id: householdId }
    )
    .first()
  if (operation.entityType === 'household' && operation.entityId !== householdId)
    throw new Error('Invalid household ID')
  if (byId || operation.action !== 'create') return byId
  // Carry-forward may already have created the same category/month on the server.
  if (operation.entityType === 'monthly_estimate') {
    return database(table)
      .where({
        household_id: householdId,
        category_id: operation.value?.categoryId,
        month: operation.value?.month,
      })
      .first()
  }
  if (operation.entityType === 'monthly_plan')
    return database(table)
      .where({ household_id: householdId, month: operation.value?.month })
      .first()
  return null
}

export async function pushOperation(
  database: Knex,
  householdId: string,
  deviceId: string,
  operation: SyncOperation
) {
  validate(operation)
  return database.transaction(async (trx) => {
    const prior = await trx('sync_receipts').where({ operation_id: operation.operationId }).first()
    if (prior && (prior.household_id !== householdId || prior.device_id !== deviceId))
      throw new Error('Operation ID already used by another device')
    if (prior?.status === 'conflict') {
      const conflict = await trx('sync_conflicts').where({ id: prior.conflict_id }).first()
      return {
        operationId: operation.operationId,
        status: 'conflict',
        conflictId: prior.conflict_id,
        serverValue: snapshot(operation.entityType, JSON.parse(conflict.server_value)),
        proposedValue: JSON.parse(conflict.proposed_value),
      }
    }
    if (prior)
      return {
        operationId: operation.operationId,
        status: 'duplicate',
        revision: prior.revision,
        conflictId: prior.conflict_id,
      }

    const current = await currentForOperation(trx, householdId, operation)
    if (
      operation.action === 'create'
        ? Boolean(current)
        : !current || current.deleted_at || current.revision !== operation.baseRevision
    ) {
      const conflictId = randomUUID()
      await trx('sync_conflicts').insert({
        id: conflictId,
        household_id: householdId,
        device_id: deviceId,
        entity_type: operation.entityType,
        entity_id: operation.entityId,
        server_value: JSON.stringify(current ?? null),
        proposed_value: JSON.stringify(operation),
        status: 'open',
        created_at: new Date().toISOString(),
      })
      await trx('sync_receipts').insert({
        operation_id: operation.operationId,
        household_id: householdId,
        device_id: deviceId,
        entity_type: operation.entityType,
        entity_id: operation.entityId,
        status: 'conflict',
        revision: current?.revision ?? null,
        conflict_id: conflictId,
        created_at: new Date().toISOString(),
      })
      return {
        operationId: operation.operationId,
        status: 'conflict',
        conflictId,
        serverValue: snapshot(operation.entityType, current ?? null),
        proposedValue: operation,
      }
    }

    let revision = operation.baseRevision + 1
    if (operation.entityType === 'category') {
      if (operation.action === 'create') {
        const row = await createCategory(
          trx,
          householdId,
          deviceId,
          operation.value!.name as string,
          { id: operation.entityId, operationId: operation.operationId }
        )
        revision = row.revision
      } else if (operation.action === 'update') {
        const row = await updateCategory(
          trx,
          householdId,
          deviceId,
          operation.entityId,
          operation.value as { name?: string; active?: boolean },
          operation.baseRevision,
          { operationId: operation.operationId }
        )
        revision = row.revision
      } else {
        await deleteCategory(
          trx,
          householdId,
          deviceId,
          operation.entityId,
          operation.baseRevision,
          { operationId: operation.operationId }
        )
      }
    } else if (operation.entityType === 'ledger_entry') {
      if (operation.action === 'create') {
        const row = await createEntry(trx, householdId, deviceId, operation.value as EntryInput, {
          id: operation.entityId,
          operationId: operation.operationId,
        })
        revision = row.revision
      } else if (operation.action === 'update') {
        const row = await updateEntry(
          trx,
          householdId,
          deviceId,
          operation.entityId,
          operation.value as Partial<EntryInput>,
          operation.baseRevision,
          { operationId: operation.operationId }
        )
        revision = row.revision
      } else {
        await deleteEntry(trx, householdId, deviceId, operation.entityId, operation.baseRevision, {
          operationId: operation.operationId,
        })
      }
    } else if (operation.entityType === 'recurring_rule') {
      if (operation.action === 'create') {
        const row = await createRecurringRule(
          trx,
          householdId,
          operation.value as RecurringRuleInput,
          deviceId,
          { id: operation.entityId, operationId: operation.operationId }
        )
        revision = row.revision
      } else {
        const household = await trx('households').where({ id: householdId }).first()
        if (!household) throw new Error('Household not found')
        const from = householdDate(new Date(), household.time_zone)
        const through = DateTime.fromISO(from).plus({ months: 12 }).toISODate()!
        if (operation.action === 'update') {
          const row = await updateRecurringRule(
            trx,
            householdId,
            operation.entityId,
            operation.value as Partial<RecurringRuleInput>,
            from,
            through,
            deviceId,
            { baseRevision: operation.baseRevision, operationId: operation.operationId }
          )
          revision = row.revision
        } else {
          const row = await deleteRecurringRule(
            trx,
            householdId,
            operation.entityId,
            from,
            through,
            deviceId,
            { baseRevision: operation.baseRevision, operationId: operation.operationId }
          )
          revision = row.revision
        }
      }
    } else if (operation.entityType === 'occurrence') {
      await confirmOccurrence(
        trx,
        householdId,
        operation.entityId,
        operation.value as { actualDate?: string; actualAmountCents?: number },
        'manual',
        deviceId,
        { baseRevision: operation.baseRevision, operationId: operation.operationId }
      )
      revision = operation.baseRevision + 1
    } else if (operation.entityType === 'monthly_estimate') {
      const value = operation.value!
      const row = await setEstimate(
        trx,
        householdId,
        deviceId,
        value.categoryId as string,
        value.month as string,
        value.amountCents as number,
        operation.baseRevision,
        { id: operation.entityId, operationId: operation.operationId }
      )
      if (row.id !== operation.entityId)
        throw new Error('Estimate ID does not match category and month')
      revision = row.revision
    } else if (operation.entityType === 'monthly_plan') {
      const value = operation.value!
      const row = await setSavingsTarget(
        trx,
        householdId,
        deviceId,
        value.month as string,
        value.savingsTargetCents as number | null,
        operation.baseRevision,
        { id: operation.entityId, operationId: operation.operationId }
      )
      if (row.id !== operation.entityId) throw new Error('Plan ID does not match month')
      revision = row.revision
    } else if (operation.entityType === 'household') {
      const row = await setHouseholdReminder(
        trx,
        householdId,
        deviceId,
        operation.baseRevision,
        operation.value!.reminderTime as string,
        operation.operationId
      )
      revision = row.revision
    }
    await trx('sync_receipts').insert({
      operation_id: operation.operationId,
      household_id: householdId,
      device_id: deviceId,
      entity_type: operation.entityType,
      entity_id: operation.entityId,
      status: 'accepted',
      revision,
      created_at: new Date().toISOString(),
    })
    return { operationId: operation.operationId, status: 'accepted', revision }
  })
}

export async function listConflicts(database: Knex, householdId: string) {
  const rows = await database('sync_conflicts')
    .where({ household_id: householdId, status: 'open' })
    .orderBy('created_at')
  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      serverValue: snapshot(
        row.entity_type,
        (await currentForOperation(database, householdId, JSON.parse(row.proposed_value))) ?? null
      ),
      proposedValue: JSON.parse(row.proposed_value),
      createdAt: row.created_at,
    }))
  )
}

/** Applying the selected version and closing its conflict is one transaction. */
export async function resolveConflict(
  database: Knex,
  householdId: string,
  deviceId: string,
  id: string,
  choice: 'server' | 'proposed',
  serverRevision?: number | null
) {
  return database.transaction(async (trx) => {
    const conflict = await trx('sync_conflicts').where({ id, household_id: householdId }).first()
    if (!conflict) throw new ApiError('Conflict not found', 404, 'NOT_FOUND')
    if (conflict.status === 'resolved')
      return { id, choice: conflict.resolution_choice ?? 'server', status: 'resolved' }
    if (choice === 'proposed') {
      const proposed = JSON.parse(conflict.proposed_value) as SyncOperation
      const stored = JSON.parse(conflict.server_value)
      const current = await currentForOperation(trx, householdId, proposed)
      if (!current) throw new ApiError('The record no longer exists', 409, 'ENTITY_MISSING')
      if (current.deleted_at)
        throw new ApiError(
          'The record has been deleted; keep the server version',
          409,
          'ENTITY_DELETED'
        )
      if ((serverRevision === undefined ? stored?.revision : serverRevision) !== current.revision)
        throw new ApiError(
          'The server record changed since this conflict was recorded',
          409,
          'REVISION_CONFLICT'
        )
      const targetId = current.id
      const revision = current.revision
      if (proposed.entityType === 'category') {
        if (proposed.action === 'delete')
          await deleteCategory(trx, householdId, deviceId, targetId, revision)
        else
          await updateCategory(
            trx,
            householdId,
            deviceId,
            targetId,
            proposed.value as { name?: string; active?: boolean },
            revision
          )
      } else if (proposed.entityType === 'ledger_entry') {
        if (proposed.action === 'delete')
          await deleteEntry(trx, householdId, deviceId, targetId, revision)
        else
          await updateEntry(
            trx,
            householdId,
            deviceId,
            targetId,
            proposed.value as Partial<EntryInput>,
            revision
          )
      } else if (proposed.entityType === 'recurring_rule') {
        const household = await trx('households').where({ id: householdId }).first()
        const from = householdDate(new Date(), household.time_zone)
        const through = DateTime.fromISO(from).plus({ months: 12 }).toISODate()!
        if (proposed.action === 'delete')
          await deleteRecurringRule(trx, householdId, targetId, from, through, deviceId, {
            baseRevision: revision,
          })
        else
          await updateRecurringRule(
            trx,
            householdId,
            targetId,
            proposed.value as Partial<RecurringRuleInput>,
            from,
            through,
            deviceId,
            { baseRevision: revision }
          )
      } else if (proposed.entityType === 'occurrence') {
        await confirmOccurrence(
          trx,
          householdId,
          targetId,
          proposed.value as { actualDate?: string; actualAmountCents?: number },
          'manual',
          deviceId,
          { baseRevision: revision }
        )
      } else if (proposed.entityType === 'monthly_estimate') {
        await setEstimate(
          trx,
          householdId,
          deviceId,
          current.category_id,
          current.month,
          proposed.value!.amountCents as number,
          revision
        )
      } else if (proposed.entityType === 'monthly_plan') {
        await setSavingsTarget(
          trx,
          householdId,
          deviceId,
          current.month,
          proposed.value!.savingsTargetCents as number | null,
          revision
        )
      } else if (proposed.entityType === 'household') {
        await setHouseholdReminder(
          trx,
          householdId,
          deviceId,
          revision,
          proposed.value!.reminderTime as string
        )
      }
    }
    await trx('sync_conflicts').where({ id, household_id: householdId, status: 'open' }).update({
      status: 'resolved',
      resolution_choice: choice,
      resolved_at: new Date().toISOString(),
    })
    return { id, choice, status: 'resolved' }
  })
}

export async function listChanges(
  database: Knex,
  householdId: string,
  afterCursor: number,
  limit = 100
) {
  if (!Number.isSafeInteger(afterCursor) || afterCursor < 0) throw new Error('Invalid cursor')
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) throw new Error('Invalid page size')
  const events = await database('change_events')
    .select(database.raw('rowid as cursor'), 'entity_type', 'entity_id', 'after_revision')
    .where('household_id', householdId)
    .whereRaw('rowid > ?', [afterCursor])
    .orderBy('rowid')
    .limit(limit + 1)
  const page = events.slice(0, limit)
  const changes = []
  for (const event of page) {
    const table = feedTables[event.entity_type]
    if (!table) continue
    if (event.after_revision === null) {
      changes.push({
        cursor: event.cursor,
        entityType: event.entity_type,
        entityId: event.entity_id,
        revision: null,
        deleted: true,
        value: null,
      })
      continue
    }
    const row = await database(table)
      .where(
        event.entity_type === 'household'
          ? { id: householdId }
          : { id: event.entity_id, household_id: householdId }
      )
      .first()
    if (!row) continue
    if (event.entity_type === 'occurrence') {
      const rule = await database('recurring_rules')
        .where({ id: row.rule_id, household_id: householdId })
        .first()
      row.ruleName = rule?.name
      row.ruleKind = rule?.kind
    }
    changes.push({
      cursor: event.cursor,
      entityType: event.entity_type,
      entityId: event.entity_id,
      revision: row.revision,
      deleted: Boolean(row.deleted_at),
      value: row.deleted_at ? null : feedValue(event.entity_type, row),
    })
  }
  return { changes, nextCursor: page.at(-1)?.cursor ?? afterCursor, hasMore: events.length > limit }
}
