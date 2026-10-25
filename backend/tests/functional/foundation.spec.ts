import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

test.group('foundation schema', () => {
  test('starter account and token tables are absent after migrations', async ({ assert }) => {
    const rows = await db.rawQuery(
      "select name from sqlite_master where type = 'table' and name in ('users', 'auth_access_tokens')"
    )
    assert.deepEqual(rows, [])
  })
})
