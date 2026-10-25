import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import {
  categoryCreateValidator,
  categoryUpdateValidator,
  deletionValidator,
  ledgerIdValidator,
} from '#validators/ledger'
import { createCategory, updateCategory, deleteCategory } from '#services/ledger'
import { listCategories } from '#services/ledger_queries'
import { categoryResource } from '../serializers/ledger.js'

export default class CategoriesController {
  async index({ device }: HttpContext) {
    const categories = await listCategories(device!.householdId)
    return { data: categories.map(categoryResource) }
  }

  async store({ device, request, response }: HttpContext) {
    const { name } = await request.validateUsing(categoryCreateValidator)
    const row = await createCategory(
      db.connection().getWriteClient(),
      device!.householdId,
      device!.id,
      name
    )
    return response.created({ data: categoryResource(row) })
  }

  async update({ device, request, params }: HttpContext) {
    const { id } = await request.validateUsing(ledgerIdValidator, { data: params })
    const { revision, ...changes } = await request.validateUsing(categoryUpdateValidator)
    const row = await updateCategory(
      db.connection().getWriteClient(),
      device!.householdId,
      device!.id,
      id,
      changes,
      revision
    )
    return { data: categoryResource(row) }
  }

  async destroy({ device, request, params, response }: HttpContext) {
    const { id } = await request.validateUsing(ledgerIdValidator, { data: params })
    const { revision } = await request.validateUsing(deletionValidator)
    await deleteCategory(
      db.connection().getWriteClient(),
      device!.householdId,
      device!.id,
      id,
      revision
    )
    return response.noContent()
  }
}
