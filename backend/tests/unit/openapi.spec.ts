import { test } from '@japa/runner'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import SwaggerParser from '@apidevtools/swagger-parser'

test.group('versioned OpenAPI contract', () => {
  test('is structurally valid OpenAPI 3.1 with concrete response and request schemas', async ({
    assert,
  }) => {
    const spec = JSON.parse(await readFile(resolve('openapi/v1.json'), 'utf8'))
    await SwaggerParser.validate(spec)
    for (const [route, paths] of Object.entries(spec.paths) as [string, Record<string, any>][]) {
      for (const [method, operation] of Object.entries(paths)) {
        if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue
        assert.isDefined(operation.responses, `${method.toUpperCase()} ${route} has responses`)
        const success = Object.entries(operation.responses).find(([status]) =>
          /^2\d\d$/.test(status)
        )
        assert.isDefined(success, `${method.toUpperCase()} ${route} has a success schema`)
        if (success![0] !== '204')
          assert.isDefined(
            (success![1] as any).content,
            `${method.toUpperCase()} ${route} has a response body`
          )
        if (['post', 'put', 'patch'].includes(method) && route !== '/api/v1/pairing-codes')
          assert.isDefined(
            operation.requestBody,
            `${method.toUpperCase()} ${route} has a request body`
          )
      }
    }
  })

  test('documents HTML, APK, and signed metadata with their actual content types', async ({
    assert,
  }) => {
    const spec = JSON.parse(await readFile(resolve('openapi/v1.json'), 'utf8'))
    assert.isDefined(spec.paths['/install'].get.responses['200'].content['text/html'])
    assert.isDefined(
      spec.paths['/install/budget.apk'].get.responses['200'].content[
        'application/vnd.android.package-archive'
      ]
    )
    assert.isDefined(
      spec.paths['/install/version.json'].get.responses['200'].content['application/json']
    )
    assert.equal(
      spec.paths['/install/version.json'].get.responses['200'].content['application/json'].schema
        .$ref,
      '#/components/schemas/ApkMetadata'
    )
  })
})
