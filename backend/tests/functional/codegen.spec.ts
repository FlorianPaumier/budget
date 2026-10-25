import { test } from '@japa/runner'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('API codegen exits without starting the financial worker or opening a database', async ({
  assert,
}) => {
  const directory = await mkdtemp(join(tmpdir(), 'budget-codegen-'))
  const database = join(directory, 'must-not-exist.sqlite3')
  try {
    await promisify(execFile)(process.execPath, ['ace.js', 'codegen'], {
      cwd: process.cwd(),
      env: { ...process.env, DB_PATH: database },
      timeout: 5000,
      killSignal: 'SIGKILL',
    })
    assert.isFalse(existsSync(database))
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}).timeout(15000)
