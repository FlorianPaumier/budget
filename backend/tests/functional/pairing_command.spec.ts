import { test } from '@japa/runner'
import ace from '@adonisjs/core/services/ace'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import PairingCode from '../../commands/pairing_code.js'

test.group('Local browser pairing', (group) => {
  group.setup(() => {
    ace.ui.switchMode('raw')
    return () => ace.ui.switchMode('normal')
  })
  group.each.setup(() => testUtils.db().truncate())

  test('requires an existing household instead of creating one', async ({ assert }) => {
    const command = await ace.create(PairingCode, [])
    await command.exec()
    command.assertFailed()
    assert.lengthOf(await db.from('pairing_codes'), 0)
    assert.lengthOf(await db.from('households'), 0)
  })

  test('issues a working single-use code without a paired phone or changing balances', async ({
    client,
    assert,
  }) => {
    await client.post('/api/v1/bootstrap').json({
      openingSpendableCents: 12345,
      openingSavingsCents: 67890,
      reminderTime: '09:00',
    })
    const before = await db.from('households').first()
    const command = await ace.create(PairingCode, [])
    await command.exec()
    command.assertSucceeded()
    const code = command.logger.getLogs().find(({ message }) => /^[\w-]{43}$/.test(message))
    assert.exists(code)
    const paired = await client.post('/api/v1/pair').json({
      pairingCode: code!.message,
      label: 'Desktop browser',
    })
    paired.assertStatus(201)
    const reused = await client.post('/api/v1/pair').json({
      pairingCode: code!.message,
      label: 'Another browser',
    })
    reused.assertStatus(410)
    assert.deepEqual(await db.from('households').first(), before)
  })

  test('does not issue pairing codes on an anonymous GET', async ({ client }) => {
    const response = await client.get('/pair')
    response.assertStatus(404)
  })
})
