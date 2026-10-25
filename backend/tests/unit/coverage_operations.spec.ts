import { test } from '@japa/runner'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { generateKeyPairSync, verify } from 'node:crypto'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import Database from 'better-sqlite3'

const execute = promisify(execFile)
const root = resolve('.')
const node = process.execPath

test.group('production operations interfaces', (group) => {
  let directory: string
  group.setup(async () => {
    const buildEnv = { ...process.env }
    delete buildEnv.NODE_V8_COVERAGE
    await execute(node, ['ace', 'build'], { cwd: root, env: buildEnv, timeout: 120_000 })
  })
  group.each.setup(async () => {
    directory = await mkdtemp(join(tmpdir(), 'budget-operations-'))
    return () => rm(directory, { recursive: true, force: true })
  })

  test('backup CLI exports encrypted SQLite and refuses to overwrite restored data', async ({
    assert,
  }) => {
    const source = join(directory, 'source.sqlite3')
    const db = new Database(source)
    db.exec('CREATE TABLE entries(amount INTEGER); INSERT INTO entries VALUES (4242)')
    db.close()
    const run = (args: string[]) =>
      execute(node, ['scripts/maintenance.mjs', ...args], {
        cwd: root,
        env: { ...process.env, BACKUP_PASSPHRASE: 'a long private export passphrase' },
      })
    const backup = await run(['backup', source, join(directory, 'backups')])
    const backupPath = backup.stdout.trim()
    const encrypted = join(directory, 'export.enc')
    const restored = join(directory, 'restored.sqlite3')
    await run(['export', backupPath, encrypted])
    assert.notDeepEqual(await readFile(encrypted), await readFile(source))
    await run(['decrypt', encrypted, restored])
    const restoredDb = new Database(restored, { readonly: true })
    assert.deepEqual(restoredDb.prepare('SELECT amount FROM entries').all(), [{ amount: 4242 }])
    restoredDb.close()
    await assert.rejects(() => run(['decrypt', encrypted, restored]), /EEXIST/)
    assert.deepEqual(await readFile(restored), await readFile(backupPath))
  }).timeout(30_000)

  test('restore CLI changes the sync generation on a stopped database', async ({ assert }) => {
    const source = join(directory, 'restored.sqlite3')
    const db = new Database(source)
    db.exec(
      "CREATE TABLE households(sync_generation TEXT, opening_spendable_cents INTEGER); INSERT INTO households VALUES ('old', 4242)"
    )
    db.close()
    const result = await execute(node, ['scripts/maintenance.mjs', 'reset-sync', source], {
      cwd: root,
    })
    const restored = new Database(source, { readonly: true })
    try {
      const row = restored.prepare('SELECT * FROM households').get() as {
        sync_generation: string
        opening_spendable_cents: number
      }
      assert.equal(row.sync_generation, result.stdout.trim())
      assert.notEqual(row.sync_generation, 'old')
      assert.equal(row.opening_spendable_cents, 4242)
    } finally {
      restored.close()
    }
  })

  test('publish CLI produces independently verifiable signed APK metadata', async ({ assert }) => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519')
    const keyPath = join(directory, 'key.pem')
    const apkPath = join(directory, 'input.apk')
    const destination = join(directory, 'published')
    await writeFile(keyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }))
    await writeFile(apkPath, 'test Android package')
    await execute(
      node,
      ['scripts/maintenance.mjs', 'publish-apk', apkPath, destination, '1.2.3', '12', keyPath],
      { cwd: root }
    )
    const { signature, ...metadata } = JSON.parse(
      await readFile(join(destination, 'version.json'), 'utf8')
    )
    assert.equal(metadata.versionCode, 12)
    assert.equal(metadata.versionName, '1.2.3')
    assert.isTrue(
      verify(
        null,
        Buffer.from(JSON.stringify(metadata)),
        publicKey,
        Buffer.from(signature, 'base64')
      )
    )
    assert.equal(await readFile(join(destination, 'budget.apk'), 'utf8'), 'test Android package')
  }).timeout(30_000)

  test('maintenance CLI reports usage failures without succeeding', async ({ assert }) => {
    for (const args of [
      [],
      ['backup'],
      ['schedule-backups'],
      ['export'],
      ['decrypt'],
      ['reset-sync'],
      ['publish-apk'],
    ]) {
      await assert.rejects(
        () =>
          execute(node, ['scripts/maintenance.mjs', ...args], {
            cwd: root,
            env: { ...process.env, BACKUP_PASSPHRASE: '' },
          }),
        /Commands:|Usage:/
      )
    }
  }).timeout(30_000)

  test('scheduled backup CLI creates a due backup and reports failures while staying alive', async ({
    assert,
  }) => {
    const source = join(directory, 'scheduled.sqlite3')
    const db = new Database(source)
    db.exec('CREATE TABLE entries(amount INTEGER); INSERT INTO entries VALUES (77)')
    db.close()
    const timeZone = ['UTC', 'Pacific/Honolulu', 'Asia/Tokyo'].find(
      (zone) =>
        Number(
          new Intl.DateTimeFormat('en-GB', {
            timeZone: zone,
            hour: '2-digit',
            hourCycle: 'h23',
          }).format(new Date())
        ) >= 3
    )!
    // The daemon has no exit command. This subprocess harness flushes V8 coverage
    // after a normal test-requested shutdown without changing its timer behavior.
    const shutdownHarness =
      'data:text/javascript,' + encodeURIComponent("process.on('SIGTERM', () => process.exit(0))")
    for (const missing of [false, true]) {
      const destination = join(directory, missing ? 'failed-backups' : 'scheduled-backups')
      const child = spawn(
        node,
        [
          '--import',
          shutdownHarness,
          'scripts/maintenance.mjs',
          'schedule-backups',
          missing ? join(directory, 'missing.sqlite3') : source,
          destination,
        ],
        {
          cwd: root,
          env: { ...process.env, HOUSEHOLD_TIME_ZONE: timeZone },
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      )
      const closed = once(child, 'close')
      let output = ''
      child.stdout.on('data', (chunk) => {
        output += chunk.toString()
      })
      child.stderr.on('data', (chunk) => {
        output += chunk.toString()
      })
      try {
        for (let attempt = 0; attempt < 100 && !output; attempt++) await delay(20)
        assert.isNull(child.exitCode)
        assert.match(
          output,
          missing ? /unable to open database file/ : /Created .*budget-.*sqlite3/
        )
        if (!missing) {
          const backupPath = output.trim().replace(/^Created /, '')
          const backup = new Database(backupPath, { readonly: true })
          assert.deepEqual(backup.prepare('SELECT amount FROM entries').all(), [{ amount: 77 }])
          backup.close()
        }
      } finally {
        child.kill('SIGTERM')
        await closed
      }
      assert.equal(child.exitCode, 0)
    }
  }).timeout(30_000)

  test('production startup rejects invalid configuration before listening', async ({ assert }) => {
    await assert.rejects(
      () =>
        execute(node, ['bin/server.js'], {
          cwd: join(root, 'build'),
          env: {
            ...process.env,
            NODE_ENV: 'production',
            APP_URL: 'invalid-url',
            DB_PATH: join(directory, 'invalid.sqlite3'),
            HOST: '127.0.0.1',
            PORT: '34792',
            APP_KEY: 'coverage-test-private-key-12345678',
            HOUSEHOLD_TIME_ZONE: 'America/Toronto',
            LOG_LEVEL: 'silent',
          },
        }),
      /APP_URL/
    )
  }).timeout(30_000)

  test('production migrations roll back cleanly and real server answers health before graceful shutdown', async ({
    assert,
  }) => {
    const database = join(directory, 'production.sqlite3')
    const env = {
      ...process.env,
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: '34791',
      APP_KEY: 'coverage-test-private-key-12345678',
      APP_URL: 'https://budget.home.arpa',
      DB_PATH: database,
      HOUSEHOLD_TIME_ZONE: 'America/Toronto',
      LOG_LEVEL: 'silent',
    }
    const migration = (command: string) =>
      execute(node, ['ace.js', command, '--force'], { cwd: join(root, 'build'), env })
    await migration('migration:run')
    await migration('migration:reset')
    const emptyDb = new Database(database)
    assert.isUndefined(
      emptyDb.prepare("SELECT name FROM sqlite_master WHERE name = 'households'").get()
    )
    emptyDb.close()
    await migration('migration:run')
    const server = spawn(node, ['bin/server.js'], {
      cwd: join(root, 'build'),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const closed = once(server, 'close')
    let output = ''
    server.stderr.on('data', (chunk) => {
      output += chunk.toString()
    })
    try {
      let response: Response | undefined
      for (let attempt = 0; attempt < 100; attempt++) {
        try {
          response = await fetch('http://127.0.0.1:34791/api/v1/health')
          break
        } catch {
          await delay(50)
        }
      }
      assert.exists(response, output)
      assert.equal(response!.status, 200)
      assert.deepEqual(await response!.json(), { data: { status: 'ok' } })
    } finally {
      server.kill('SIGTERM')
      await closed
    }
    assert.equal(server.exitCode, 0, output)
  }).timeout(60_000)
})
