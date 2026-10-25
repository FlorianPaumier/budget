import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import db from '@adonisjs/lucid/services/db'
import { hashSecret } from '#services/device_access'

declare module '@adonisjs/core/http' {
  interface HttpContext {
    device?: { id: string; householdId: string }
  }
}

export default class DeviceAuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const authorization = ctx.request.header('authorization')
    if (!authorization?.startsWith('Bearer ')) {
      return ctx.response.unauthorized({ code: 'DEVICE_AUTH_REQUIRED' })
    }
    const credential = authorization.slice(7)
    if (credential.length < 32 || credential.length > 256) {
      return ctx.response.unauthorized({ code: 'DEVICE_AUTH_REQUIRED' })
    }
    const device = await db
      .from('devices')
      .where('credential_hash', hashSecret(credential))
      .whereNull('revoked_at')
      .first()
    if (!device) return ctx.response.unauthorized({ code: 'DEVICE_AUTH_REQUIRED' })
    ctx.device = { id: device.id, householdId: device.household_id }
    return next()
  }
}
