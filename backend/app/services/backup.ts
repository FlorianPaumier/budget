import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
  scrypt as callbackScrypt,
} from 'node:crypto'
import { promisify } from 'node:util'
import { mkdir, readdir, readFile, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import Database from 'better-sqlite3'

const scrypt = promisify(callbackScrypt)
const prefix = Buffer.from('BUDGET01')

/** Run on a stopped, restored database before phones reconnect. */
export function resetSyncGeneration(path: string) {
  const database = new Database(path, { fileMustExist: true })
  try {
    if (database.pragma('integrity_check', { simple: true }) !== 'ok')
      throw new Error('Restored database failed integrity check')
    const generation = randomUUID()
    database.prepare('UPDATE households SET sync_generation = ?').run(generation)
    return generation
  } finally {
    database.close()
  }
}

export function backupDate(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (type: string) => parts.find((item) => item.type === type)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export async function backupIfDue(
  source: string,
  destination: string,
  now: Date,
  timeZone: string,
  retention = 30
): Promise<string | null> {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(now)
  )
  if (hour < 3) return null
  const date = backupDate(now, timeZone)
  const path = join(destination, `budget-${date}.sqlite3`)
  try {
    await stat(path)
    return null
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  return createDailyBackup(source, destination, date, retention)
}

export async function createDailyBackup(
  source: string,
  destination: string,
  date: string,
  retention = 30
): Promise<string> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid backup date')
  if (!Number.isInteger(retention) || retention < 1) throw new Error('Invalid retention')
  await mkdir(destination, { recursive: true })
  const file = join(destination, `budget-${date}.sqlite3`)
  const database = new Database(source, { readonly: true, fileMustExist: true })
  try {
    await database.backup(file)
  } finally {
    database.close()
  }
  const names = await readdir(destination)
  const backups = names.filter((name) => /^budget-\d{4}-\d{2}-\d{2}\.sqlite3$/.test(name)).sort()
  for (const old of backups.slice(0, Math.max(0, backups.length - retention)))
    await rm(join(destination, old))
  return file
}

export async function encryptBackupExport(plaintext: Buffer, passphrase: string): Promise<Buffer> {
  if (passphrase.length < 12) throw new Error('Passphrase must be at least 12 characters')
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = (await scrypt(passphrase, salt, 32)) as Buffer
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  return Buffer.concat([prefix, salt, iv, cipher.getAuthTag(), ciphertext])
}

export async function decryptBackupExport(encrypted: Buffer, passphrase: string): Promise<Buffer> {
  if (encrypted.length < 52 || !encrypted.subarray(0, 8).equals(prefix))
    throw new Error('Invalid backup export')
  const salt = encrypted.subarray(8, 24)
  const iv = encrypted.subarray(24, 36)
  const tag = encrypted.subarray(36, 52)
  const ciphertext = encrypted.subarray(52)
  const key = (await scrypt(passphrase, salt, 32)) as Buffer
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

export async function encryptedBackupFile(path: string, passphrase: string): Promise<Buffer> {
  return encryptBackupExport(await readFile(path), passphrase)
}
