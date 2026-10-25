import vine from '@vinejs/vine'
import { isoDate, month, positiveRevision, safeCents, uuid } from './common.js'

export const categoryCreateValidator = vine.compile(
  vine.object({ name: vine.string().trim().minLength(1).maxLength(120) })
)
export const categoryUpdateValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(120).optional(),
    active: vine.boolean().optional(),
    revision: positiveRevision(),
  })
)
export const deletionValidator = vine.compile(vine.object({ revision: positiveRevision() }))
export const ledgerIdValidator = vine.compile(vine.object({ id: uuid() }))

const kind = () =>
  vine.enum([
    'income',
    'expense',
    'category_adjustment',
    'savings_transfer',
    'balance_adjustment',
  ] as const)
const account = () => vine.enum(['spendable', 'savings'] as const).optional()

export const entryCreateValidator = vine.compile(
  vine.object({
    kind: kind(),
    entryDate: isoDate(),
    amountCents: safeCents(),
    categoryId: uuid().nullable().optional(),
    account: account(),
    note: vine.string().maxLength(500).nullable().optional(),
  })
)

export const entryUpdateValidator = vine.compile(
  vine.object({
    kind: kind().optional(),
    entryDate: isoDate().optional(),
    amountCents: safeCents().optional(),
    categoryId: uuid().nullable().optional(),
    account: account(),
    note: vine.string().maxLength(500).nullable().optional(),
    revision: positiveRevision(),
  })
)

export const entriesQueryValidator = vine.compile(vine.object({ month: month().optional() }))
export const balancesQueryValidator = vine.compile(vine.object({ asOf: isoDate() }))
export const actualsQueryValidator = vine.compile(vine.object({ today: isoDate() }))
export const monthPathValidator = vine.compile(vine.object({ month: month() }))
