import { test } from '@japa/runner'
import { generateKeyPairSync } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { publishApk, verifyApkMetadata, installPageHtml } from '../../app/services/distribution.js'

test.group('local Android distribution', (group) => {
  let dir: string
  group.each.setup(async () => {
    dir = await mkdtemp(join(tmpdir(), 'budget-apk-'))
    return async () => rm(dir, { recursive: true, force: true })
  })

  test('publishes signed version metadata bound to the APK bytes', async ({ assert }) => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519')
    const apk = Buffer.from('example apk bytes')
    const manifest = await publishApk(
      dir,
      apk,
      { versionName: '1.2.0', versionCode: 12 },
      privateKey
    )
    assert.equal(manifest.versionCode, 12)
    assert.isTrue(verifyApkMetadata(manifest, apk, publicKey))
    assert.isFalse(verifyApkMetadata(manifest, Buffer.from('tampered'), publicKey))
    assert.deepEqual(await readFile(join(dir, 'budget.apk')), apk)
  })

  test('renders an install QR for the local APK URL without pairing secrets', async ({
    assert,
  }) => {
    const html = await installPageHtml('http://budget.local:3333', '1.2.0')
    assert.include(html, 'http://budget.local:3333/install/budget.apk')
    assert.include(html, 'data:image/png;base64,')
    assert.include(html, '1.2.0')
    assert.notInclude(html, 'pairing')
  })
})
