import vine from '@vinejs/vine'
import { baseRevision, isoDate, month, safeCents, uuid } from './common.js'
import type { SyncOperation } from '#services/sync'

export const pushValidator = vine.create({
  generation: uuid().optional(),
  operations: vine.array(vine.any().nullable()).minLength(1).maxLength(100),
})
export const changesValidator = vine.create({
  cursor: vine.number().withoutDecimals().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  limit: vine.number().withoutDecimals().min(1).max(500).optional(),
})
export const resolveValidator = vine.create({
  generation: uuid().optional(),
  params: vine.object({ id: uuid() }),
  choice: vine.enum(['server', 'proposed']),
  serverRevision: baseRevision().min(1).nullable().optional(),
})
const operationValidator = vine.create({
  operationId: uuid(),
  entityId: uuid(),
  entityType: vine.enum([
    'category',
    'ledger_entry',
    'recurring_rule',
    'occurrence',
    'monthly_estimate',
    'monthly_plan',
    'household',
  ]),
  action: vine.enum(['create', 'update', 'delete']),
  baseRevision: baseRevision(),
  value: vine.record(vine.any().nullable()).optional(),
})
const categoryCreate = vine.create({ name: vine.string().trim().minLength(1).maxLength(120) })
const categoryUpdate = vine.create({
  name: vine.string().trim().minLength(1).maxLength(120).optional(),
  active: vine.boolean({ strict: true }).optional(),
})
const entryFields = () => ({
  kind: vine.enum([
    'income',
    'expense',
    'category_adjustment',
    'savings_transfer',
    'balance_adjustment',
  ]),
  entryDate: isoDate(),
  amountCents: safeCents(),
  categoryId: uuid().nullable().optional(),
  account: vine.enum(['spendable', 'savings']).optional(),
  note: vine.string().maxLength(500).nullable().optional(),
})
const entryCreate = vine.create(entryFields())
const entryUpdate = vine.create({
  ...entryFields(),
  kind: entryFields().kind.optional(),
  entryDate: isoDate().optional(),
  amountCents: safeCents().optional(),
})
const ruleFields = () => ({
  kind: vine.enum(['income', 'bill', 'subscription']),
  name: vine.string().trim().minLength(1).maxLength(160),
  categoryId: uuid().nullable().optional(),
  amountCents: safeCents().min(1),
  frequency: vine.enum(['daily', 'weekly', 'biweekly', 'twice_monthly', 'monthly', 'yearly']),
  interval: baseRevision().min(1).max(1000),
  startsOn: isoDate(),
  endsOn: isoDate().nullable().optional(),
  scheduleDetails: vine
    .object({
      days: vine
        .array(vine.number({ strict: true }).withoutDecimals().min(1).max(31))
        .fixedLength(2),
    })
    .nullable()
    .optional(),
})
const ruleCreate = vine.create(ruleFields())
const ruleUpdate = vine.create({
  ...ruleFields(),
  kind: ruleFields().kind.optional(),
  name: ruleFields().name.optional(),
  amountCents: ruleFields().amountCents.optional(),
  frequency: ruleFields().frequency.optional(),
  interval: ruleFields().interval.optional(),
  startsOn: isoDate().optional(),
  active: vine.boolean({ strict: true }).optional(),
})
const occurrenceUpdate = vine.create({
  actualDate: isoDate().optional(),
  actualAmountCents: safeCents().min(1).optional(),
})
const estimateWrite = vine.create({
  categoryId: uuid(),
  month: month(),
  amountCents: safeCents().min(0),
})
const planWrite = vine.create({ month: month(), savingsTargetCents: safeCents().min(0).nullable() })
const householdWrite = vine.create({
  reminderTime: vine.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
})

/** Validate each operation separately so one bad queued edit does not discard a batch. */
export async function validateSyncOperation(input: unknown): Promise<SyncOperation> {
  const operation = await operationValidator.validate(input)
  if (operation.action === 'delete') return operation
  const schemas = {
    category: operation.action === 'create' ? categoryCreate : categoryUpdate,
    ledger_entry: operation.action === 'create' ? entryCreate : entryUpdate,
    recurring_rule: operation.action === 'create' ? ruleCreate : ruleUpdate,
    occurrence: occurrenceUpdate,
    monthly_estimate: estimateWrite,
    monthly_plan: planWrite,
    household: householdWrite,
  }
  const value = await schemas[operation.entityType].validate(operation.value)
  return { ...operation, value }
}
