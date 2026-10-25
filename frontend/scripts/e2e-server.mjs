import { createServer } from 'node:net'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn, execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
for (const port of [3000, 4333])
  await new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', () =>
      reject(
        new Error(
          `Port ${port} is occupied; refusing to test an existing service`,
        ),
      ),
    )
    probe.listen(port, '127.0.0.1', () => probe.close(resolve))
  })
const directory = mkdtempSync(join(tmpdir(), 'budget-web-e2e-'))
const backend = new URL('../../backend/', import.meta.url)
const env = {
  ...process.env,
  NODE_ENV: 'test',
  DB_PATH: join(directory, 'test.sqlite3'),
  PORT: '4333',
  HOST: '127.0.0.1',
  APP_URL: 'http://127.0.0.1:4333',
  HOUSEHOLD_TIME_ZONE: 'America/Toronto',
}
if (
  !env.DB_PATH.startsWith(directory) ||
  !directory.includes('budget-web-e2e-')
)
  throw new Error('Unsafe test database')
execFileSync(process.execPath, ['ace.js', 'migration:run', '--force'], {
  cwd: backend,
  env,
  stdio: 'inherit',
})
const api = spawn(
  process.execPath,
  ['--import', '@poppinss/ts-exec', 'bin/server.ts'],
  {
    cwd: backend,
    env,
    stdio: 'inherit',
  },
)
// Start can become healthy before Adonis has bound its socket.
try {
  const deadline = Date.now() + 15_000
  while (true) {
    if (api.exitCode !== null)
      throw new Error('Disposable Adonis exited before readiness')
    const ready = await fetch('http://127.0.0.1:4333/api/v1/health', {
      signal: AbortSignal.timeout(1000),
    })
      .then((response) => response.ok)
      .catch(() => false)
    if (ready) break
    if (Date.now() >= deadline)
      throw new Error('Disposable Adonis did not become ready')
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
} catch (error) {
  api.kill('SIGTERM')
  rmSync(directory, { recursive: true, force: true })
  throw error
}
const web = spawn(
  process.execPath,
  ['--import', './scripts/check-env.mjs', '.output/server/index.mjs'],
  {
    cwd: new URL('../', import.meta.url),
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: '3000',
      HOST: '127.0.0.1',
      BUDGET_API_URL: 'http://127.0.0.1:4333',
      WEB_ORIGIN: 'http://localhost:3000',
      SESSION_SECRET: randomBytes(48).toString('base64url'),
    },
    stdio: 'inherit',
  },
)
let closing = false
function close() {
  if (closing) return
  closing = true
  api.kill('SIGTERM')
  web.kill('SIGTERM')
  setTimeout(() => {
    rmSync(directory, { recursive: true, force: true })
    process.exit()
  }, 500).unref()
}
process.on('SIGINT', close)
process.on('SIGTERM', close)
api.on('exit', () => {
  if (!closing) close()
})
web.on('exit', () => {
  if (!closing) close()
})
