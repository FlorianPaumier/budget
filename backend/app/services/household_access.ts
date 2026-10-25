import { randomUUID } from 'node:crypto'
import type { Knex } from 'knex'
import db from '@adonisjs/lucid/services/db'
import { ApiError } from '#exceptions/api_error'
import { createPairingCode, hashSecret, newSecret } from './device_access.js'
import { householdDate } from './household_date.js'

export async function bootstrapHousehold(
  input: { openingSpendableCents: number; openingSavingsCents: number; reminderTime: string },
  timeZone: string
) {
  return db.transaction(async (trx) => {
    if (await trx.from('households').first())
      throw new ApiError('Household already initialized', 409, 'ALREADY_INITIALIZED')
    const id = randomUUID()
    const now = new Date().toISOString()
    await trx.table('households').insert({
      id,
      currency: 'CAD',
      time_zone: timeZone,
      reminder_time: input.reminderTime,
      opening_spendable_cents: input.openingSpendableCents,
      opening_savings_cents: input.openingSavingsCents,
      opening_date: householdDate(new Date(now), timeZone),
      revision: 1,
      created_at: now,
      updated_at: now,
    })
    await trx.table('change_events').insert({
      id: randomUUID(),
      household_id: id,
      device_id: null,
      entity_type: 'household',
      entity_id: id,
      before_revision: null,
      after_revision: 1,
      created_at: now,
    })
    const row = await trx.from('households').where({ id }).first()
    return { household: row, pairingCode: await createPairingCode(id, trx.getWriteClient()) }
  })
}

export async function pairPhone(pairingCode: string, label: string) {
  return db.transaction(async (trx) => {
    const now = new Date().toISOString()
    const code = await trx
      .from('pairing_codes')
      .where({ code_hash: hashSecret(pairingCode) })
      .first()
    if (!code || code.used_at || code.expires_at <= now)
      throw new ApiError('Pairing code unavailable', 410, 'PAIRING_CODE_UNAVAILABLE')
    const claimed = await trx
      .from('pairing_codes')
      .where({ id: code.id })
      .whereNull('used_at')
      .where('expires_at', '>', now)
      .update({ used_at: now })
    if (Number(claimed) !== 1)
      throw new ApiError('Pairing code unavailable', 410, 'PAIRING_CODE_UNAVAILABLE')
    const credential = newSecret()
    const deviceId = randomUUID()
    await trx.table('devices').insert({
      id: deviceId,
      household_id: code.household_id,
      label,
      credential_hash: hashSecret(credential),
      paired_at: now,
    })
    return { deviceId, householdId: code.household_id, credential }
  })
}

export async function householdForDevice(householdId: string) {
  const row = await db.from('households').where({ id: householdId }).first()
  if (!row) throw new ApiError('Household not found', 404, 'HOUSEHOLD_NOT_FOUND')
  return row
}

export async function updateReminder(
  householdId: string,
  deviceId: string,
  revision: number,
  reminderTime: string
) {
  return setHouseholdReminder(
    db.connection().getWriteClient(),
    householdId,
    deviceId,
    revision,
    reminderTime
  )
}

export async function setHouseholdReminder(
  database: Knex,
  householdId: string,
  deviceId: string,
  revision: number,
  reminderTime: string,
  operationId?: string
) {
  return database.transaction(async (trx) => {
    const now = new Date().toISOString()
    const changed = await trx('households')
      .where({ id: householdId, revision })
      .update({ reminder_time: reminderTime, revision: revision + 1, updated_at: now })
    if (Number(changed) !== 1) {
      if (!(await trx('households').where({ id: householdId }).first()))
        throw new ApiError('Household not found', 404, 'HOUSEHOLD_NOT_FOUND')
      throw new ApiError('Household revision conflict', 409, 'REVISION_CONFLICT')
    }
    await trx('change_events').insert({
      id: randomUUID(),
      household_id: householdId,
      device_id: deviceId,
      entity_type: 'household',
      entity_id: householdId,
      before_revision: revision,
      after_revision: revision + 1,
      operation_id: operationId ?? null,
      created_at: now,
    })
    return trx('households').where({ id: householdId }).first()
  })
}

export async function devicesForHousehold(householdId: string) {
  return db
    .from('devices')
    .where({ household_id: householdId })
    .select('id', 'label', 'paired_at', 'revoked_at')
    .orderBy('paired_at')
}

export async function renameDevice(householdId: string, deviceId: string, label: string) {
  const changed = await db
    .from('devices')
    .where({ household_id: householdId, id: deviceId })
    .whereNull('revoked_at')
    .update({ label })
  if (Number(changed) !== 1) throw new ApiError('Device not found', 404, 'DEVICE_NOT_FOUND')
  return db.from('devices').where({ id: deviceId, household_id: householdId }).first()
}

export async function revokeDevice(householdId: string, deviceId: string) {
  const changed = await db
    .from('devices')
    .where({ household_id: householdId, id: deviceId })
    .whereNull('revoked_at')
    .update({ revoked_at: new Date().toISOString() })
  if (Number(changed) !== 1) throw new ApiError('Device not found', 404, 'DEVICE_NOT_FOUND')
}

export async function invalidatePairingCodes(householdId: string) {
  await db
    .from('pairing_codes')
    .where({ household_id: householdId })
    .whereNull('used_at')
    .update({ used_at: new Date().toISOString() })
}
