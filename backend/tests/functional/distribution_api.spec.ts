import { test } from '@japa/runner'
import { generateKeyPairSync } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import SwaggerParser from '@apidevtools/swagger-parser'
import { Ajv2020 } from 'ajv/dist/2020.js'
import { publishApk } from '../../app/services/distribution.js'

test.group('local APK distribution', (group) => {
  let directory: string
  group.each.setup(async () => {
    directory = await mkdtemp(join(tmpdir(), 'budget-distribution-api-'))
    process.env.APK_DIRECTORY = directory
    process.env.INSTALL_BASE_URL = 'https://budget.home.arpa'
    return async () => {
      delete process.env.APK_DIRECTORY
      delete process.env.INSTALL_BASE_URL
      await rm(directory, { recursive: true, force: true })
    }
  })

  test('published APK, signed metadata, and install page are public and separate from pairing', async ({
    client,
    assert,
  }) => {
    const privateKey = generateKeyPairSync('ed25519').privateKey
    await publishApk(
      directory,
      Buffer.from('apk bytes'),
      { versionName: '1.2.0', versionCode: 12 },
      privateKey
    )

    const install = await client.get('/install')
    install.assertStatus(200)
    assert.include(install.text(), 'https://budget.home.arpa/install/budget.apk')
    assert.include(install.text(), 'data:image/png;base64,')
    const metadata = await client.get('/install/version.json')
    metadata.assertStatus(200)
    assert.equal(metadata.body().versionCode, 12)
    assert.isString(metadata.body().signature)
    assert.isUndefined(metadata.body().data)
    const spec: any = await SwaggerParser.dereference(resolve('openapi/v1.json'))
    const schema =
      spec.paths['/install/version.json'].get.responses['200'].content['application/json'].schema
    const validate = new Ajv2020({ strict: false, validateFormats: false }).compile(schema)
    assert.isTrue(validate(metadata.body()), JSON.stringify(validate.errors))
    const apk = await client.get('/install/budget.apk')
    apk.assertStatus(200)
    assert.equal(apk.header('content-type'), 'application/vnd.android.package-archive')
  })

  test('install surfaces return 404 when no APK has been published', async ({ client }) => {
    const install = await client.get('/install')
    const version = await client.get('/install/version.json')
    const apk = await client.get('/install/budget.apk')
    install.assertStatus(404)
    version.assertStatus(404)
    apk.assertStatus(404)
  })
})
