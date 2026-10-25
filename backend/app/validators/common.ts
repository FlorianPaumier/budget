import vine from '@vinejs/vine'
import { DateTime } from 'luxon'

const calendarDate = vine.createRule((value, _options, field) => {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !DateTime.fromISO(value, { zone: 'utc' }).isValid
  ) {
    field.report(
      'The {{ field }} field must be a valid calendar date (YYYY-MM-DD)',
      'calendarDate',
      field
    )
  }
})

export const uuid = () => vine.string().uuid()
export const safeCents = () =>
  vine
    .number({ strict: true })
    .withoutDecimals()
    .min(Number.MIN_SAFE_INTEGER)
    .max(Number.MAX_SAFE_INTEGER)
export const positiveRevision = () =>
  vine.number({ strict: true }).withoutDecimals().min(1).max(Number.MAX_SAFE_INTEGER)
export const baseRevision = () =>
  vine.number({ strict: true }).withoutDecimals().min(0).max(Number.MAX_SAFE_INTEGER)
export const isoDate = () => vine.string().use(calendarDate())
export const month = () => vine.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)
