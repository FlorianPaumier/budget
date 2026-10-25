import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { ApiError } from '#exceptions/api_error'
import {
  createRuleValidator,
  updateRuleValidator,
  deleteRuleValidator,
  ruleIdValidator,
} from '../validators/recurrence.js'
import {
  createRecurringRule,
  deleteRecurringRule,
  getRecurringRule,
  listRecurringRules,
  updateRecurringRule,
  type RecurringRuleInput,
} from '#services/recurrence_store'
import { ruleResource } from '../serializers/recurrence.js'

function validRange(from: string, through: string) {
  if (from > through) throw new ApiError('Invalid date range', 422, 'VALIDATION_ERROR')
}

export default class RecurringRulesController {
  async index({ device }: HttpContext) {
    const rows = await listRecurringRules(db.connection().getReadClient(), device!.householdId)
    return { data: rows.map(ruleResource) }
  }

  async show({ request, device }: HttpContext) {
    const { params } = await request.validateUsing(ruleIdValidator)
    const row = await getRecurringRule(
      db.connection().getReadClient(),
      device!.householdId,
      params.id
    )
    return { data: ruleResource(row) }
  }

  async store({ request, response, device }: HttpContext) {
    const payload = await request.validateUsing(createRuleValidator)
    const input = {
      ...payload,
      categoryId: payload.categoryId ?? null,
      endsOn: payload.endsOn ?? null,
    } as RecurringRuleInput
    const row = await createRecurringRule(
      db.connection().getWriteClient(),
      device!.householdId,
      input,
      device!.id
    )
    return response.created({ data: ruleResource(row) })
  }

  async update({ request, device }: HttpContext) {
    const payload = await request.validateUsing(updateRuleValidator)
    const { params, revision, from, through, ...changes } = payload
    validRange(from, through)
    await updateRecurringRule(
      db.connection().getWriteClient(),
      device!.householdId,
      params.id,
      changes as Partial<RecurringRuleInput>,
      from,
      through,
      device!.id,
      { baseRevision: revision }
    )
    const row = await getRecurringRule(
      db.connection().getReadClient(),
      device!.householdId,
      params.id
    )
    return { data: ruleResource(row) }
  }

  async destroy({ request, response, device }: HttpContext) {
    const { params, revision, from, through } = await request.validateUsing(deleteRuleValidator)
    validRange(from, through)
    await deleteRecurringRule(
      db.connection().getWriteClient(),
      device!.householdId,
      params.id,
      from,
      through,
      device!.id,
      { baseRevision: revision }
    )
    return response.noContent()
  }
}
