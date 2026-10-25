import { test } from '@japa/runner'
import { generateKeyPairSync } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  backupIfDue,
  createDailyBackup,
  decryptBackupExport,
  encryptBackupExport,
  encryptedBackupFile,
} from '../../app/services/backup.js'
import { installPageHtml, publishApk, verifyApkMetadata } from '../../app/services/distribution.js'

test.group('recovery and distribution boundaries', (group) => {
  let dir: string
  group.each.setup(async () => {
    dir = await mkdtemp(join(tmpdir(), 'budget-recovery-coverage-'))
    return () => rm(dir, { recursive: true, force: true })
  })

  test('rejects invalid backup inputs before creating a destination', async ({ assert }) => {
    await assert.rejects(
      () => createDailyBackup('missing.sqlite3', dir, 'not-a-date'),
      'Invalid backup date'
    )
    for (const retention of [0, 1.5])
      await assert.rejects(
        () => createDailyBackup('missing.sqlite3', dir, '2026-10-05', retention),
        'Invalid retention'
      )
    await assert.rejects(
      () => encryptBackupExport(Buffer.from('budget'), 'short'),
      'Passphrase must be at least 12 characters'
    )
    await assert.rejects(
      () => decryptBackupExport(Buffer.alloc(3), 'long passphrase'),
      'Invalid backup export'
    )
    await assert.rejects(
      () => decryptBackupExport(Buffer.alloc(60), 'long passphrase'),
      'Invalid backup export'
    )
  })

  test('exports a backup file and detects modification of encrypted content', async ({
    assert,
  }) => {
    const source = join(dir, 'backup.sqlite3')
    const bytes = Buffer.from('private saved budget')
    await writeFile(source, bytes)
    const encrypted = await encryptedBackupFile(source, 'long private passphrase')
    assert.deepEqual(await decryptBackupExport(encrypted, 'long private passphrase'), bytes)
    encrypted[encrypted.length - 1] ^= 1
    await assert.rejects(() => decryptBackupExport(encrypted, 'long private passphrase'))
    assert.deepEqual(await readFile(source), bytes)
  })

  test('scheduler reports inaccessible destination instead of treating it as an absent backup', async ({
    assert,
  }) => {
    const destination = join(dir, 'not-a-directory')
    await writeFile(destination, 'file')
    await assert.rejects(() =>
      backupIfDue(
        'missing.sqlite3',
        destination,
        new Date('2026-10-05T12:00:00Z'),
        'America/Toronto'
      )
    )
  })

  test('APK versions reject malformed names, fractions, and nonpositive version codes', async ({
    assert,
  }) => {
    const { privateKey } = generateKeyPairSync('ed25519')
    for (const version of [
      { versionName: 'latest', versionCode: 1 },
      { versionName: '1.0.0', versionCode: 1.5 },
      { versionName: '1.0.0', versionCode: 0 },
    ])
      await assert.rejects(
        () => publishApk(dir, Buffer.from('apk'), version, privateKey),
        'Invalid APK version'
      )
  })

  test('metadata signature binds the version as well as the APK bytes', async ({ assert }) => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519')
    const other = generateKeyPairSync('ed25519')
    const apk = Buffer.from('private apk')
    const metadata = await publishApk(
      dir,
      apk,
      { versionName: '1.0.0', versionCode: 1 },
      privateKey
    )
    assert.isFalse(verifyApkMetadata({ ...metadata, versionCode: 2 }, apk, publicKey))
    assert.isFalse(verifyApkMetadata(metadata, apk, other.publicKey))
    const html = await installPageHtml('https://budget.home.arpa/', '<script>"&\'</script>')
    assert.include(html, 'https://budget.home.arpa/install/budget.apk')
    assert.include(html, '&lt;script&gt;&quot;&amp;&#39;&lt;/script&gt;')
    assert.notInclude(html, '<script>')
  })
})

test.group('background recurrence recovery', () => {
  test('reports failed runs, retries the next tick, and ignores ticks after stop', async ({
    assert,
  }) => {
    const { startOverdueWorker } = await import('../../app/services/recurrence_worker.js')
    let tick: () => void = () => {}
    let attempts = 0
    let cancelled = false
    const failures: unknown[] = []
    const failure = new Error('temporary database outage')
    const stop = startOverdueWorker(
      async () => {
        attempts++
        if (attempts === 1) throw failure
      },
      (callback) => {
        tick = callback
        return () => {
          cancelled = true
        }
      },
      (error) => failures.push(error)
    )
    await new Promise((resolve) => setImmediate(resolve))
    assert.deepEqual(failures, [failure])
    tick()
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(attempts, 2)
    stop()
    assert.isTrue(cancelled)
    tick()
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(attempts, 2)
  })
})
