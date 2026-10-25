import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import { ApiError } from '#exceptions/api_error'
import { bootstrapValidator, reminderValidator } from '#validators/access'
import { bootstrapHousehold, householdForDevice, updateReminder } from '#services/household_access'
import { householdResource } from '../serializers/access.js'

export default class HouseholdsController {
  async bootstrap({ request, response }: HttpContext) {
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.ip()))
      throw new ApiError('Setup is local only', 403, 'LOCAL_ONLY')
    const input = await request.validateUsing(bootstrapValidator)
    const result = await bootstrapHousehold(input, env.get('HOUSEHOLD_TIME_ZONE'))
    return response.created({
      data: {
        household: householdResource(result.household),
        pairingCode: result.pairingCode,
        expiresInSeconds: 300,
      },
    })
  }

  async show({ device }: HttpContext) {
    return { data: householdResource(await householdForDevice(device!.householdId)) }
  }

  async update({ request, device }: HttpContext) {
    const input = await request.validateUsing(reminderValidator)
    return {
      data: householdResource(
        await updateReminder(device!.householdId, device!.id, input.revision, input.reminderTime)
      ),
    }
  }
}
