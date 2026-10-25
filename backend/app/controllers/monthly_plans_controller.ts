import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import {
  estimateValidator,
  planMonthValidator,
  savingsTargetValidator,
  suggestionValidator,
} from '../validators/monthly_planning.js'
import { estimateResource, savingsTargetResource } from '../serializers/monthly_planning.js'
import {
  getMonthlyPlan,
  medianSuggestion,
  setEstimate,
  setSavingsTarget,
} from '#services/monthly_planning'

export default class MonthlyPlansController {
  async setEstimate({ request, device }: HttpContext) {
    const { params, amountCents, revision, id, operationId } =
      await request.validateUsing(estimateValidator)
    const row = await setEstimate(
      db.connection().getWriteClient(),
      device!.householdId,
      device!.id,
      params.categoryId,
      params.month,
      amountCents,
      revision,
      { id, operationId }
    )
    return { data: estimateResource(row) }
  }

  async setSavingsTarget({ request, device }: HttpContext) {
    const { params, amountCents, revision, id, operationId } =
      await request.validateUsing(savingsTargetValidator)
    const row = await setSavingsTarget(
      db.connection().getWriteClient(),
      device!.householdId,
      device!.id,
      params.month,
      amountCents,
      revision,
      { id, operationId }
    )
    return { data: savingsTargetResource(row) }
  }

  async show({ request, device }: HttpContext) {
    const { params } = await request.validateUsing(planMonthValidator)
    const { totals, estimates, target } = await getMonthlyPlan(
      db.connection().getWriteClient(),
      device!.householdId,
      params.month
    )
    return {
      data: {
        month: params.month,
        ...totals,
        estimates: estimates.map(estimateResource),
        savingsTarget: target ? savingsTargetResource(target) : null,
      },
    }
  }

  async suggestion({ request, device }: HttpContext) {
    const { params } = await request.validateUsing(suggestionValidator)
    const suggestion = await medianSuggestion(
      db.connection().getReadClient(),
      device!.householdId,
      params.categoryId,
      params.month
    )
    return { data: { categoryId: params.categoryId, month: params.month, ...suggestion } }
  }
}
