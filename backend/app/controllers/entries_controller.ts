import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import {
  deletionValidator,
  entriesQueryValidator,
  entryCreateValidator,
  entryUpdateValidator,
  ledgerIdValidator,
} from '#validators/ledger'
import { createEntry, updateEntry, deleteEntry } from '#services/ledger'
import { entryHistory, findEntry, listEntries } from '#services/ledger_queries'
import { entryHistoryResource, entryResource } from '../serializers/ledger.js'

export default class EntriesController {
  async index({ device, request }: HttpContext) {
    const { month } = await request.validateUsing(entriesQueryValidator, { data: request.qs() })
    const entries = await listEntries(device!.householdId, month)
    return { data: entries.map(entryResource) }
  }

  async show({ device, request, params }: HttpContext) {
    const { id } = await request.validateUsing(ledgerIdValidator, { data: params })
    return { data: entryResource(await findEntry(device!.householdId, id)) }
  }

  async store({ device, request, response }: HttpContext) {
    const input = await request.validateUsing(entryCreateValidator)
    const row = await createEntry(
      db.connection().getWriteClient(),
      device!.householdId,
      device!.id,
      input
    )
    return response.created({ data: entryResource(row) })
  }

  async update({ device, request, params }: HttpContext) {
    const { id } = await request.validateUsing(ledgerIdValidator, { data: params })
    const { revision, ...changes } = await request.validateUsing(entryUpdateValidator)
    const row = await updateEntry(
      db.connection().getWriteClient(),
      device!.householdId,
      device!.id,
      id,
      changes,
      revision
    )
    return { data: entryResource(row) }
  }

  async destroy({ device, request, params, response }: HttpContext) {
    const { id } = await request.validateUsing(ledgerIdValidator, { data: params })
    const { revision } = await request.validateUsing(deletionValidator)
    await deleteEntry(
      db.connection().getWriteClient(),
      device!.householdId,
      device!.id,
      id,
      revision
    )
    return response.noContent()
  }

  async history({ device, request, params }: HttpContext) {
    const { id } = await request.validateUsing(ledgerIdValidator, { data: params })
    const history = await entryHistory(device!.householdId, id)
    return { data: history.map(entryHistoryResource) }
  }
}
