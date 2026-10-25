import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import { pairValidator } from '#validators/access'
import { pairPhone, invalidatePairingCodes } from '#services/household_access'
import { createPairingCode } from '#services/device_access'

export default class PairingController {
  async pair({ request, response }: HttpContext) {
    const input = await request.validateUsing(pairValidator)
    return response.created({ data: await pairPhone(input.pairingCode, input.label) })
  }

  async createCode({ device, response }: HttpContext) {
    const pairingCode = await createPairingCode(device!.householdId)
    const pairingUri = new URL('budget://pair')
    pairingUri.searchParams.set('server', env.get('APP_URL'))
    pairingUri.searchParams.set('code', pairingCode)
    return response.created({
      data: { pairingCode, pairingUri: pairingUri.toString(), expiresInSeconds: 300 },
    })
  }

  async invalidateCodes({ device, response }: HttpContext) {
    await invalidatePairingCodes(device!.householdId)
    return response.noContent()
  }
}
