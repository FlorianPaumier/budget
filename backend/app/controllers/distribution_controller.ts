import type { HttpContext } from '@adonisjs/core/http'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { installPageHtml } from '#services/distribution'

export default class DistributionController {
  async index({ response }: HttpContext) {
    const directory = process.env.APK_DIRECTORY
    const baseUrl = process.env.INSTALL_BASE_URL
    if (!directory || !baseUrl) return response.notFound({ code: 'APK_NOT_PUBLISHED' })
    try {
      const manifest = JSON.parse(await readFile(join(directory, 'version.json'), 'utf8')) as {
        versionName: string
      }
      response.header('Content-Type', 'text/html; charset=utf-8')
      return response.send(await installPageHtml(baseUrl, manifest.versionName))
    } catch {
      return response.notFound({ code: 'APK_NOT_PUBLISHED' })
    }
  }

  async version({ response }: HttpContext) {
    const directory = process.env.APK_DIRECTORY
    if (!directory) return response.notFound({ code: 'APK_NOT_PUBLISHED' })
    try {
      response.header('Content-Type', 'application/json')
      return response.send(await readFile(join(directory, 'version.json'), 'utf8'))
    } catch {
      return response.notFound({ code: 'APK_NOT_PUBLISHED' })
    }
  }

  async apk({ response }: HttpContext) {
    const directory = process.env.APK_DIRECTORY
    if (!directory) return response.notFound({ code: 'APK_NOT_PUBLISHED' })
    try {
      const apk = await readFile(join(directory, 'budget.apk'))
      response.header('Content-Type', 'application/vnd.android.package-archive')
      response.header('Content-Disposition', 'attachment; filename="budget.apk"')
      return response.send(apk)
    } catch {
      return response.notFound({ code: 'APK_NOT_PUBLISHED' })
    }
  }
}
