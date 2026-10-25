import { test } from '@japa/runner'
import router from '@adonisjs/core/services/router'

test.group('private backend documentation', () => {
  test('serves a browsable page and downloadable versioned OpenAPI document', async ({
    client,
    assert,
  }) => {
    const page = await client.get('/docs')
    page.assertStatus(200)
    assert.include(page.text(), '/openapi/v1.json')
    assert.include(page.text(), 'Request body')
    assert.include(page.text(), 'Response statuses')
    assert.include(page.text(), 'Authorization: Bearer')
    assert.include(page.text(), 'openingSpendableCents')
    const response = await client.get('/openapi/v1.json')
    response.assertStatus(200)
    const spec = response.body()
    assert.equal(spec.openapi, '3.1.0')
    assert.equal(spec.info.version, '1.0.0')
    assert.isDefined(spec.components.securitySchemes.deviceBearer)
    assert.isDefined(spec.paths['/api/v1/sync/push'].post)
  })

  test('OpenAPI method and path inventory equals registered public and API routes', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/openapi/v1.json')
    const spec = response.body()
    const documented = Object.entries(spec.paths as Record<string, Record<string, unknown>>)
      .flatMap(([path, operations]) =>
        Object.keys(operations)
          .filter((key) => ['get', 'post', 'put', 'patch', 'delete'].includes(key))
          .map((method) => `${method.toUpperCase()} ${path}`)
      )
      .sort()
    const registered = Object.values(router.toJSON())
      .flat()
      .flatMap((route) =>
        route.methods
          .filter((method) => method !== 'HEAD')
          .map(
            (method) => `${method} ${route.pattern.replace(/:([a-zA-Z][a-zA-Z0-9_]*)/g, '{$1}')}`
          )
      )
      .sort()
    assert.deepEqual(documented, registered)
  })
})
