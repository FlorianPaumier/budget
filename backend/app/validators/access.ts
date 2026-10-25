import vine from '@vinejs/vine'
import { positiveRevision, safeCents, uuid } from './common.js'

const reminderTime = () => vine.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)

export const bootstrapValidator = vine.compile(
  vine.object({
    openingSpendableCents: safeCents(),
    openingSavingsCents: safeCents(),
    reminderTime: reminderTime(),
  })
)

export const pairValidator = vine.compile(
  vine.object({
    pairingCode: vine.string().minLength(32).maxLength(256),
    label: vine.string().trim().minLength(1).maxLength(120),
  })
)

export const deviceLabelValidator = vine.compile(
  vine.object({ label: vine.string().trim().minLength(1).maxLength(120) })
)
export const reminderValidator = vine.compile(
  vine.object({ reminderTime: reminderTime(), revision: positiveRevision() })
)
export const accessIdValidator = vine.compile(vine.object({ id: uuid() }))
