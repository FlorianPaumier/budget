import type { HttpContext } from '@adonisjs/core/http'
import { accessIdValidator, deviceLabelValidator } from '#validators/access'
import { devicesForHousehold, renameDevice, revokeDevice } from '#services/household_access'
import { deviceResource } from '../serializers/access.js'

export default class DevicesController {
  async index({ device }: HttpContext) {
    const devices = await devicesForHousehold(device!.householdId)
    return { data: devices.map(deviceResource) }
  }

  async update({ device, request, params }: HttpContext) {
    const { id } = await request.validateUsing(accessIdValidator, { data: params })
    const { label } = await request.validateUsing(deviceLabelValidator)
    return { data: deviceResource(await renameDevice(device!.householdId, id, label)) }
  }

  async destroy({ device, request, params, response }: HttpContext) {
    const { id } = await request.validateUsing(accessIdValidator, { data: params })
    await revokeDevice(device!.householdId, id)
    return response.noContent()
  }
}
