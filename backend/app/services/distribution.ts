import { createHash, sign, verify, type KeyObject } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import QRCode from 'qrcode'

export type ApkMetadata = {
  versionName: string
  versionCode: number
  sha256: string
  signature: string
}

function signedBytes(metadata: Omit<ApkMetadata, 'signature'>): Buffer {
  return Buffer.from(JSON.stringify(metadata))
}

export async function publishApk(
  directory: string,
  apk: Buffer,
  version: { versionName: string; versionCode: number },
  privateKey: KeyObject
): Promise<ApkMetadata> {
  if (
    !/^\d+\.\d+\.\d+$/.test(version.versionName) ||
    !Number.isSafeInteger(version.versionCode) ||
    version.versionCode < 1
  ) {
    throw new Error('Invalid APK version')
  }
  const unsigned = { ...version, sha256: createHash('sha256').update(apk).digest('hex') }
  const metadata = {
    ...unsigned,
    signature: sign(null, signedBytes(unsigned), privateKey).toString('base64'),
  }
  await mkdir(directory, { recursive: true })
  await writeFile(join(directory, 'budget.apk'), apk)
  await writeFile(join(directory, 'version.json'), JSON.stringify(metadata))
  return metadata
}

export function verifyApkMetadata(
  metadata: ApkMetadata,
  apk: Buffer,
  publicKey: KeyObject
): boolean {
  const { signature, ...unsigned } = metadata
  return (
    createHash('sha256').update(apk).digest('hex') === metadata.sha256 &&
    verify(null, signedBytes(unsigned), publicKey, Buffer.from(signature, 'base64'))
  )
}

export async function installPageHtml(baseUrl: string, versionName: string): Promise<string> {
  const apkUrl = `${baseUrl.replace(/\/$/, '')}/install/budget.apk`
  const qr = await QRCode.toDataURL(apkUrl)
  return `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Install Budget</title><main><h1>Install Budget for Android</h1><p>Version ${escapeHtml(versionName)}</p><p><a href="${escapeHtml(apkUrl)}">Download Android APK</a></p><img src="${qr}" alt="QR code for the Android APK"><p>Scan on an Android phone connected to the home Wi-Fi. Pair the app separately after installation.</p></main></html>`
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!
  )
}
