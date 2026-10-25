import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

test.group('documented device access', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('every documented Bearer route rejects anonymous and revoked phones', async ({
    client,
    assert,
  }) => {
    const setup = await client
      .post('/api/v1/bootstrap')
      .json({ openingSpendableCents: 0, openingSavingsCents: 0, reminderTime: '09:00' })
    const paired = await client
      .post('/api/v1/pair')
      .json({ pairingCode: setup.body().data.pairingCode, label: 'Phone' })
    const credential = paired.body().data.credential
    const deviceId = paired.body().data.deviceId
    await client
      .delete(`/api/v1/devices/${deviceId}`)
      .header('Authorization', `Bearer ${credential}`)
    const spec = JSON.parse(await readFile(resolve('openapi/v1.json'), 'utf8'))
    for (const [pattern, operations] of Object.entries(spec.paths) as [
      string,
      Record<string, any>,
    ][]) {
      for (const [method, operation] of Object.entries(operations)) {
        if (
          !['get', 'post', 'put', 'patch', 'delete'].includes(method) ||
          operation.security?.length === 0
        )
          continue
        const path = pattern
          .replace(/\{month\}/g, '2026-10')
          .replace(/\{categoryId\}|\{id\}/g, '11111111-1111-4111-8111-111111111111')
        const anonymous = await (client as any)[method](path)
        assert.equal(anonymous.status(), 401, `${method.toUpperCase()} ${pattern} anonymous`)
        const revoked = await (client as any)
          [method](path)
          .header('Authorization', `Bearer ${credential}`)
        assert.equal(revoked.status(), 401, `${method.toUpperCase()} ${pattern} revoked`)
      }
    }
  })
})
