import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import {
  actualsQueryValidator,
  balancesQueryValidator,
  monthPathValidator,
} from '#validators/ledger'
import { balancesAsOf, monthActuals } from '#services/ledger'

export default class BalancesController {
  async show({ device, request }: HttpContext) {
    const { asOf } = await request.validateUsing(balancesQueryValidator, { data: request.qs() })
    return { data: await balancesAsOf(db.connection().getWriteClient(), device!.householdId, asOf) }
  }

  async actuals({ device, request, params }: HttpContext) {
    const { month } = await request.validateUsing(monthPathValidator, { data: params })
    const { today } = await request.validateUsing(actualsQueryValidator, { data: request.qs() })
    return {
      data: await monthActuals(db.connection().getWriteClient(), device!.householdId, month, today),
    }
  }
}
