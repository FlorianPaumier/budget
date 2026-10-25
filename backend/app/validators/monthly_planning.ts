import vine from '@vinejs/vine'
import { baseRevision, month, safeCents, uuid } from './common.js'

export const estimateValidator = vine.create({
  params: vine.object({ month: month(), categoryId: uuid() }),
  amountCents: safeCents().min(0),
  revision: baseRevision(),
  id: uuid().optional(),
  operationId: uuid().optional(),
})
export const savingsTargetValidator = vine.create({
  params: vine.object({ month: month() }),
  amountCents: safeCents().min(0).nullable(),
  revision: baseRevision(),
  id: uuid().optional(),
  operationId: uuid().optional(),
})
export const planMonthValidator = vine.create({ params: vine.object({ month: month() }) })
export const suggestionValidator = vine.create({
  params: vine.object({ month: month(), categoryId: uuid() }),
})
