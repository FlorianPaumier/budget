import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import SwaggerParser from '@apidevtools/swagger-parser'
import { Ajv2020 } from 'ajv/dist/2020.js'

test.group('documented HTTP schemas', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('setup, budget, sync, and validation responses match OpenAPI', async ({
    client,
    assert,
  }) => {
    const spec: any = await SwaggerParser.dereference(resolve('openapi/v1.json'))
    const ajv = new Ajv2020({ strict: false, validateFormats: false })
    const matches = (method: string, path: string, status: number, body: unknown) => {
      const schema =
        spec.paths[path][method].responses[String(status)].content['application/json'].schema
      const validate = ajv.compile(schema)
      assert.isTrue(
        validate(body),
        `${method.toUpperCase()} ${path}: ${JSON.stringify(validate.errors)}`
      )
    }

    const health = await client.get('/api/v1/health')
    matches('get', '/api/v1/health', 200, health.body())
    const setup = await client
      .post('/api/v1/bootstrap')
      .json({ openingSpendableCents: 100000, openingSavingsCents: 50000, reminderTime: '09:00' })
    matches('post', '/api/v1/bootstrap', 201, setup.body())
    const paired = await client
      .post('/api/v1/pair')
      .json({ pairingCode: setup.body().data.pairingCode, label: 'Phone' })
    matches('post', '/api/v1/pair', 201, paired.body())
    const auth = `Bearer ${paired.body().data.credential}`
    const category = await client
      .post('/api/v1/categories')
      .header('Authorization', auth)
      .json({ name: 'Food' })
    matches('post', '/api/v1/categories', 201, category.body())
    const balances = await client
      .get('/api/v1/balances?asOf=2026-10-01')
      .header('Authorization', auth)
    matches('get', '/api/v1/balances', 200, balances.body())
    const bad = await client
      .post('/api/v1/categories')
      .header('Authorization', auth)
      .json({ name: '' })
    bad.assertStatus(422)
    matches('post', '/api/v1/categories', 422, bad.body())
    const malformedBatch = await client
      .post('/api/v1/sync/push')
      .header('Authorization', auth)
      .json({ operations: [] })
    malformedBatch.assertStatus(422)
    matches('post', '/api/v1/sync/push', 422, malformedBatch.body())

    const operationId = randomUUID()
    const entityId = randomUUID()
    const pushed = await client
      .post('/api/v1/sync/push')
      .header('Authorization', auth)
      .json({
        operations: [
          {
            operationId,
            entityId,
            entityType: 'category',
            action: 'create',
            baseRevision: 0,
            value: { name: 'Transport' },
          },
        ],
      })
    matches('post', '/api/v1/sync/push', 200, pushed.body())
    const changes = await client.get('/api/v1/sync/changes?cursor=0').header('Authorization', auth)
    matches('get', '/api/v1/sync/changes', 200, changes.body())
    const acceptedUpdate = await client
      .post('/api/v1/sync/push')
      .header('Authorization', auth)
      .json({
        operations: [
          {
            operationId: randomUUID(),
            entityId,
            entityType: 'category',
            action: 'update',
            baseRevision: 1,
            value: { name: 'Bus' },
          },
        ],
      })
    assert.equal(acceptedUpdate.body().data.outcomes[0].status, 'accepted')
    const conflict = await client
      .post('/api/v1/sync/push')
      .header('Authorization', auth)
      .json({
        operations: [
          {
            operationId: randomUUID(),
            entityId,
            entityType: 'category',
            action: 'update',
            baseRevision: 1,
            value: { name: 'Train' },
          },
        ],
      })
    assert.equal(conflict.body().data.outcomes[0].status, 'conflict')
    matches('post', '/api/v1/sync/push', 200, conflict.body())
    const conflicts = await client.get('/api/v1/sync/conflicts').header('Authorization', auth)
    assert.isAbove(conflicts.body().data.conflicts.length, 0)
    matches('get', '/api/v1/sync/conflicts', 200, conflicts.body())
  })
})
