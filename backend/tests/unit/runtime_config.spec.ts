import { test } from '@japa/runner'
import { resolveRuntimeConfig } from '../../config/runtime.js'

test.group('runtime configuration', () => {
  test('rejects a relative persistent database path', ({ assert }) => {
    assert.throws(
      () => resolveRuntimeConfig({ dbPath: './data/budget.sqlite3', timeZone: 'America/Toronto' }),
      /DB_PATH must be absolute/
    )
  })

  test('requires a persistent database path in production', ({ assert }) => {
    assert.throws(
      () => resolveRuntimeConfig({ dbPath: '', timeZone: 'America/Toronto', production: true }),
      /DB_PATH is required in production/
    )
  })

  test('rejects an invalid household time zone', ({ assert }) => {
    assert.throws(
      () => resolveRuntimeConfig({ dbPath: '/srv/budget/data.sqlite3', timeZone: 'Mars/Phobos' }),
      /invalid household time zone/
    )
  })

  test('accepts an absolute database path and IANA time zone', ({ assert }) => {
    assert.deepEqual(
      resolveRuntimeConfig({ dbPath: '/srv/budget/data.sqlite3', timeZone: 'America/Toronto' }),
      { dbPath: '/srv/budget/data.sqlite3', timeZone: 'America/Toronto' }
    )
  })

  test('rejects an insecure production API URL used in pairing QR codes', ({ assert }) => {
    assert.throws(
      () =>
        resolveRuntimeConfig({
          dbPath: '/srv/budget/data.sqlite3',
          timeZone: 'America/Toronto',
          appUrl: 'http://budget.home.arpa',
          production: true,
        }),
      /APP_URL must use HTTPS in production/
    )
  })
})
