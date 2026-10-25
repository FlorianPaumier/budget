import { test } from '@japa/runner'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import {
  createDailyBackup,
  decryptBackupExport,
  encryptBackupExport,
  backupDate,
  backupIfDue,
  resetSyncGeneration,
} from '../../app/services/backup.js'

test.group('local backups', (group) => {
  let dir: string
  group.each.setup(async () => {
    dir = await mkdtemp(join(tmpdir(), 'budget-backup-'))
    return async () => rm(dir, { recursive: true, force: true })
  })

  test('creates a consistent SQLite backup and retains only the newest three', async ({
    assert,
  }) => {
    const source = join(dir, 'budget.sqlite3')
    const db = new Database(source)
    db.exec('CREATE TABLE entries (amount INTEGER); INSERT INTO entries VALUES (1234)')
    db.close()

    for (const date of ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']) {
      await createDailyBackup(source, join(dir, 'backups'), date, 3)
    }
    const backupNames = await readdir(join(dir, 'backups'))
    const names = backupNames.sort()
    assert.deepEqual(names, [
      'budget-2026-10-02.sqlite3',
      'budget-2026-10-03.sqlite3',
      'budget-2026-10-04.sqlite3',
    ])
    const restored = new Database(join(dir, 'backups', names[2]), { readonly: true })
    assert.equal(
      (restored.prepare('SELECT amount FROM entries').get() as { amount: number }).amount,
      1234
    )
    restored.close()
  })

  test('restore reset rotates history without changing household money', ({ assert }) => {
    const source = join(dir, 'restored.sqlite3')
    const db = new Database(source)
    db.exec(
      "CREATE TABLE households(sync_generation TEXT, opening_spendable_cents INTEGER); INSERT INTO households VALUES ('old', 4242)"
    )
    db.close()
    const generation = resetSyncGeneration(source)
    const restored = new Database(source)
    assert.deepEqual(restored.prepare('SELECT * FROM households').get(), {
      sync_generation: generation,
      opening_spendable_cents: 4242,
    })
    restored.close()
    assert.notEqual(resetSyncGeneration(source), generation)
  })

  test('encrypted export round trips and rejects a wrong password', async ({ assert }) => {
    const plaintext = Buffer.from('private household budget')
    const encrypted = await encryptBackupExport(plaintext, 'long private passphrase')
    assert.notInclude(encrypted.toString(), plaintext.toString())
    assert.deepEqual(await decryptBackupExport(encrypted, 'long private passphrase'), plaintext)
    await assert.rejects(() => decryptBackupExport(encrypted, 'wrong passphrase'))
  })

  test('uses the household date when UTC has crossed midnight', ({ assert }) => {
    assert.equal(backupDate(new Date('2026-10-02T01:00:00Z'), 'America/Toronto'), '2026-10-01')
  })

  test('daily scheduler creates one backup after 03:00 local time', async ({ assert }) => {
    const source = join(dir, 'budget.sqlite3')
    const db = new Database(source)
    db.exec('CREATE TABLE entries (amount INTEGER); INSERT INTO entries VALUES (99)')
    db.close()
    const destination = join(dir, 'backups')
    assert.isNull(
      await backupIfDue(source, destination, new Date('2026-10-01T06:59:00Z'), 'America/Toronto')
    )
    assert.equal(
      await backupIfDue(source, destination, new Date('2026-10-01T07:01:00Z'), 'America/Toronto'),
      join(destination, 'budget-2026-10-01.sqlite3')
    )
    assert.isNull(
      await backupIfDue(source, destination, new Date('2026-10-01T08:00:00Z'), 'America/Toronto')
    )
    assert.lengthOf(await readdir(destination), 1)
  })
})
