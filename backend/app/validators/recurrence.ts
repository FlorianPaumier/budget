import vine from '@vinejs/vine'
import { isoDate, positiveRevision, safeCents, uuid } from './common.js'

const frequency = vine.enum(['daily', 'weekly', 'biweekly', 'twice_monthly', 'monthly', 'yearly'])
const kind = vine.enum(['income', 'bill', 'subscription'])
const details = vine.object({
  days: vine
    .array(vine.number({ strict: true }).withoutDecimals().min(1).max(31))
    .minLength(2)
    .maxLength(2),
})
const dateRange = { from: isoDate(), through: isoDate() }
const fields = {
  kind,
  name: vine.string().trim().minLength(1).maxLength(160),
  categoryId: uuid().nullable().optional(),
  amountCents: safeCents().min(1),
  frequency,
  interval: vine.number({ strict: true }).withoutDecimals().min(1).max(1000),
  startsOn: isoDate(),
  endsOn: isoDate().nullable().optional(),
  scheduleDetails: details.nullable().optional(),
}

export const createRuleValidator = vine.create(fields)
export const updateRuleValidator = vine.create({
  params: vine.object({ id: uuid() }),
  kind: kind.optional(),
  name: fields.name.optional(),
  categoryId: uuid().nullable().optional(),
  amountCents: fields.amountCents.optional(),
  frequency: frequency.optional(),
  interval: fields.interval.optional(),
  startsOn: isoDate().optional(),
  endsOn: isoDate().nullable().optional(),
  scheduleDetails: details.nullable().optional(),
  active: vine.boolean({ strict: true }).optional(),
  revision: positiveRevision(),
  ...dateRange,
})
export const deleteRuleValidator = vine.create({
  params: vine.object({ id: uuid() }),
  revision: positiveRevision(),
  ...dateRange,
})
export const ruleIdValidator = vine.create({ params: vine.object({ id: uuid() }) })
export const occurrenceRangeValidator = vine.create({ ...dateRange, today: isoDate().optional() })
export const confirmOccurrenceValidator = vine.create({
  params: vine.object({ id: uuid() }),
  revision: positiveRevision(),
  actualDate: isoDate().optional(),
  actualAmountCents: safeCents().min(1).optional(),
})
export const occurrenceIdValidator = vine.create({ params: vine.object({ id: uuid() }) })
