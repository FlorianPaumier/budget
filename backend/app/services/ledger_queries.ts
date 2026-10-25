import db from '@adonisjs/lucid/services/db'
import { ApiError } from '#exceptions/api_error'

export function listCategories(householdId: string) {
  return db
    .from('categories')
    .where({ household_id: householdId })
    .whereNull('deleted_at')
    .orderBy('name')
}

export function listEntries(householdId: string, month?: string) {
  const query = db
    .from('ledger_entries')
    .where({ household_id: householdId })
    .whereNull('deleted_at')
    .orderBy('entry_date', 'desc')
  if (month) query.where('entry_date', 'like', `${month}%`)
  return query
}

export async function findEntry(householdId: string, id: string) {
  const row = await db
    .from('ledger_entries')
    .where({ household_id: householdId, id })
    .whereNull('deleted_at')
    .first()
  if (!row) throw new ApiError('Entry not found', 404, 'ENTRY_NOT_FOUND')
  return row
}

export async function entryHistory(householdId: string, id: string) {
  await findEntry(householdId, id)
  return db
    .from('change_events as e')
    .leftJoin('devices as d', 'd.id', 'e.device_id')
    .where({ 'e.household_id': householdId, 'e.entity_type': 'ledger_entry', 'e.entity_id': id })
    .select('e.*', 'd.label as device_label')
    .orderBy('e.rowid')
}
