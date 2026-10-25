import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { backupDate, backupIfDue, createDailyBackup, decryptBackupExport, encryptBackupExport, resetSyncGeneration } from '../build/app/services/backup.js'
import { setInterval } from 'node:timers/promises'
import { publishApk } from '../build/app/services/distribution.js'
import { createPrivateKey } from 'node:crypto'

const [command, ...args] = process.argv.slice(2)

try {
  if (command === 'reset-sync') {
    const [dbPath] = args
    if (!dbPath) throw new Error('Usage: reset-sync DB_PATH (API must be stopped)')
    console.log(resetSyncGeneration(dbPath))
  } else if (command === 'backup') {
    const [dbPath, backupDir] = args
    if (!dbPath || !backupDir) throw new Error('Usage: backup DB_PATH BACKUP_DIR')
    const date = backupDate(new Date(), process.env.HOUSEHOLD_TIME_ZONE || 'America/Toronto')
    console.log(await createDailyBackup(dbPath, backupDir, date, Number(process.env.BACKUP_RETENTION_DAYS || 30)))
  } else if (command === 'schedule-backups') {
    const [dbPath, backupDir] = args
    if (!dbPath || !backupDir) throw new Error('Usage: schedule-backups DB_PATH BACKUP_DIR')
    const check = async () => {
      try {
        const path = await backupIfDue(dbPath, backupDir, new Date(), process.env.HOUSEHOLD_TIME_ZONE || 'America/Toronto', Number(process.env.BACKUP_RETENTION_DAYS || 30))
        if (path) console.log(`Created ${path}`)
      } catch (error) {
        console.error(error instanceof Error ? error.message : error)
      }
    }
    await check()
    for await (const _ of setInterval(60_000)) await check()
  } else if (command === 'export') {
    const [backupPath, outputPath] = args
    if (!backupPath || !outputPath || !process.env.BACKUP_PASSPHRASE) throw new Error('Usage: BACKUP_PASSPHRASE=... export BACKUP_PATH OUTPUT_PATH')
    await writeFile(outputPath, await encryptBackupExport(await readFile(backupPath), process.env.BACKUP_PASSPHRASE), { mode: 0o600 })
  } else if (command === 'decrypt') {
    const [encryptedPath, outputPath] = args
    if (!encryptedPath || !outputPath || !process.env.BACKUP_PASSPHRASE) throw new Error('Usage: BACKUP_PASSPHRASE=... decrypt ENCRYPTED_PATH OUTPUT_PATH')
    await writeFile(outputPath, await decryptBackupExport(await readFile(encryptedPath), process.env.BACKUP_PASSPHRASE), { flag: 'wx', mode: 0o600 })
  } else if (command === 'publish-apk') {
    const [apkPath, outputDir, versionName, codeText, keyPath] = args
    if (!apkPath || !outputDir || !versionName || !codeText || !keyPath) throw new Error('Usage: publish-apk APK_PATH OUTPUT_DIR VERSION_NAME VERSION_CODE ED25519_PRIVATE_KEY_PATH')
    await mkdir(outputDir, { recursive: true })
    await publishApk(outputDir, await readFile(apkPath), { versionName, versionCode: Number(codeText) }, createPrivateKey(await readFile(keyPath)))
  } else {
    throw new Error('Commands: backup, schedule-backups, export, decrypt, reset-sync, publish-apk')
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
