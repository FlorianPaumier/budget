import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'

test.group('Household device access', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('initializes one household from the server host and returns a single-use pairing code', async ({
    client,
  }) => {
    const first = await client.post('/api/v1/bootstrap').json({
      openingSpendableCents: 120000,
      openingSavingsCents: 450000,
      reminderTime: '09:00',
    })

    first.assertStatus(201)
    first.assertBodyContains({
      data: { household: { currency: 'CAD', timeZone: 'America/Toronto' } },
    })
    const pairingCode = first.body().data.pairingCode
    if (typeof pairingCode !== 'string' || pairingCode.length < 32) {
      throw new Error('bootstrap did not return a strong pairing code')
    }

    const second = await client.post('/api/v1/bootstrap').json({
      openingSpendableCents: 0,
      openingSavingsCents: 0,
      reminderTime: '09:00',
    })
    second.assertStatus(409)
  })

  test('pairs a phone once and rejects a reused pairing code', async ({ client }) => {
    const bootstrap = await client.post('/api/v1/bootstrap').json({
      openingSpendableCents: 0,
      openingSavingsCents: 0,
      reminderTime: '09:00',
    })
    const code = bootstrap.body().data.pairingCode

    const first = await client
      .post('/api/v1/pair')
      .json({ pairingCode: code, label: 'Kitchen phone' })
    first.assertStatus(201)
    const credential = first.body().data.credential
    if (typeof credential !== 'string' || credential.length < 32) {
      throw new Error('pairing did not issue a strong credential')
    }

    const reused = await client
      .post('/api/v1/pair')
      .json({ pairingCode: code, label: 'Other phone' })
    reused.assertStatus(410)
  })

  test('protects devices and rejects a revoked credential', async ({ client }) => {
    const bootstrap = await client.post('/api/v1/bootstrap').json({
      openingSpendableCents: 0,
      openingSavingsCents: 0,
      reminderTime: '09:00',
    })
    const paired = await client.post('/api/v1/pair').json({
      pairingCode: bootstrap.body().data.pairingCode,
      label: 'Kitchen phone',
    })
    const { deviceId, credential } = paired.body().data

    const anonymous = await client.get('/api/v1/devices')
    anonymous.assertStatus(401)

    const authorized = await client
      .get('/api/v1/devices')
      .header('Authorization', `Bearer ${credential}`)
    authorized.assertStatus(200)
    authorized.assertBodyContains({ data: [{ id: deviceId, label: 'Kitchen phone' }] })

    const revoked = await client
      .delete(`/api/v1/devices/${deviceId}`)
      .header('Authorization', `Bearer ${credential}`)
    revoked.assertStatus(204)

    const blocked = await client
      .get('/api/v1/devices')
      .header('Authorization', `Bearer ${credential}`)
    blocked.assertStatus(401)
  })

  test('only a paired phone can issue and reset pairing codes', async ({ client }) => {
    const bootstrap = await client.post('/api/v1/bootstrap').json({
      openingSpendableCents: 0,
      openingSavingsCents: 0,
      reminderTime: '09:00',
    })
    const paired = await client.post('/api/v1/pair').json({
      pairingCode: bootstrap.body().data.pairingCode,
      label: 'First phone',
    })
    const credential = paired.body().data.credential

    const anonymous = await client.post('/api/v1/pairing-codes')
    anonymous.assertStatus(401)

    const issued = await client
      .post('/api/v1/pairing-codes')
      .header('Authorization', `Bearer ${credential}`)
    issued.assertStatus(201)
    const nextCode = issued.body().data.pairingCode
    if (
      typeof issued.body().data.pairingUri !== 'string' ||
      !issued.body().data.pairingUri.includes(nextCode)
    ) {
      throw new Error('pairing response is missing the QR payload')
    }

    const reset = await client
      .delete('/api/v1/pairing-codes')
      .header('Authorization', `Bearer ${credential}`)
    reset.assertStatus(204)
    const invalidated = await client.post('/api/v1/pair').json({
      pairingCode: nextCode,
      label: 'Second phone',
    })
    invalidated.assertStatus(410)
  })

  test('an expired pairing code cannot pair a phone', async ({ client }) => {
    const bootstrap = await client.post('/api/v1/bootstrap').json({
      openingSpendableCents: 0,
      openingSavingsCents: 0,
      reminderTime: '09:00',
    })
    await db.from('pairing_codes').update({ expires_at: '2000-01-01T00:00:00.000Z' })
    const expired = await client.post('/api/v1/pair').json({
      pairingCode: bootstrap.body().data.pairingCode,
      label: 'Late phone',
    })
    expired.assertStatus(410)
  })

  test('renames a paired phone and shows its new label', async ({ client }) => {
    const bootstrap = await client.post('/api/v1/bootstrap').json({
      openingSpendableCents: 0,
      openingSavingsCents: 0,
      reminderTime: '09:00',
    })
    const paired = await client.post('/api/v1/pair').json({
      pairingCode: bootstrap.body().data.pairingCode,
      label: 'Old label',
    })
    const { deviceId, credential } = paired.body().data
    const renamed = await client
      .patch(`/api/v1/devices/${deviceId}`)
      .header('Authorization', `Bearer ${credential}`)
      .json({ label: 'New label' })
    renamed.assertStatus(200)
    renamed.assertBodyContains({ data: { id: deviceId, label: 'New label' } })
  })

  test('a paired phone can read household settings but an unpaired phone cannot', async ({
    client,
  }) => {
    const bootstrap = await client.post('/api/v1/bootstrap').json({
      openingSpendableCents: 120000,
      openingSavingsCents: 450000,
      reminderTime: '08:30',
    })
    const anonymous = await client.get('/api/v1/household')
    anonymous.assertStatus(401)
    const paired = await client.post('/api/v1/pair').json({
      pairingCode: bootstrap.body().data.pairingCode,
      label: 'Phone',
    })
    const settings = await client
      .get('/api/v1/household')
      .header('Authorization', `Bearer ${paired.body().data.credential}`)
    settings.assertStatus(200)
    settings.assertBodyContains({
      data: {
        currency: 'CAD',
        reminderTime: '08:30',
        openingSpendableCents: 120000,
        openingSavingsCents: 450000,
      },
    })
  })

  test('simultaneous setup requests cannot create two households', async ({ client, assert }) => {
    const payload = { openingSpendableCents: 0, openingSavingsCents: 0, reminderTime: '09:00' }
    const responses = await Promise.all([
      client.post('/api/v1/bootstrap').json(payload),
      client.post('/api/v1/bootstrap').json(payload),
    ])
    assert.deepEqual(responses.map((item) => item.status()).sort(), [201, 409])
    const households = await db.from('households')
    assert.lengthOf(households, 1)
  })

  test('paired phones read and revise the shared reminder hour with optimistic revision', async ({
    client,
  }) => {
    const bootstrap = await client
      .post('/api/v1/bootstrap')
      .json({ openingSpendableCents: 0, openingSavingsCents: 0, reminderTime: '09:00' })
    const paired = await client
      .post('/api/v1/pair')
      .json({ pairingCode: bootstrap.body().data.pairingCode, label: 'Phone' })
    const auth = `Bearer ${paired.body().data.credential}`
    const initial = await client.get('/api/v1/household').header('Authorization', auth)
    initial.assertBodyContains({ data: { reminderTime: '09:00', revision: 1 } })
    const updated = await client
      .patch('/api/v1/household')
      .header('Authorization', auth)
      .json({ reminderTime: '07:30', revision: 1 })
    updated.assertStatus(200)
    updated.assertBodyContains({
      data: { reminderTime: '07:30', revision: 2, currency: 'CAD', timeZone: 'America/Toronto' },
    })
    const stale = await client
      .patch('/api/v1/household')
      .header('Authorization', auth)
      .json({ reminderTime: '08:00', revision: 1 })
    stale.assertStatus(409)
    const invalid = await client
      .patch('/api/v1/household')
      .header('Authorization', auth)
      .json({ reminderTime: '25:99', revision: 2 })
    invalid.assertStatus(422)
  })
})
