import { createHash, randomBytes, randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import type { Knex } from 'knex'

export function hashSecret(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export function newSecret() {
  return randomBytes(32).toString('base64url')
}

export async function createPairingCode(householdId: string, database?: Knex | Knex.Transaction) {
  const code = newSecret()
  const now = new Date()
  await (database ?? db.connection().getWriteClient())('pairing_codes').insert({
    id: randomUUID(),
    household_id: householdId,
    code_hash: hashSecret(code),
    expires_at: new Date(now.getTime() + 5 * 60_000).toISOString(),
    created_at: now.toISOString(),
  })
  return code
}
