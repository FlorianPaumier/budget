import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { ApiError } from '#exceptions/api_error'
import { confirmOccurrenceValidator, occurrenceRangeValidator } from '../validators/recurrence.js'
import {
  confirmOccurrence,
  listOccurrences,
  listOccurrencesInRange,
} from '#services/recurrence_store'
import { householdDate } from '#services/household_date'
import { occurrenceResource } from '../serializers/recurrence.js'

export default class OccurrencesController {
  async index({ request, device }: HttpContext) {
    const {
      from,
      through,
      today: requestedToday,
    } = await request.validateUsing(occurrenceRangeValidator)
    const rows = await listOccurrencesInRange(
      db.connection().getWriteClient(),
      device!.householdId,
      from,
      through,
      requestedToday
    )
    return { data: rows.map(occurrenceResource) }
  }

  async confirm({ request, device }: HttpContext) {
    const { params, revision, actualDate, actualAmountCents } = await request.validateUsing(
      confirmOccurrenceValidator
    )
    const client = db.connection().getWriteClient()
    const entry = await confirmOccurrence(
      client,
      device!.householdId,
      params.id,
      { actualDate, actualAmountCents },
      'manual',
      device!.id,
      { baseRevision: revision }
    )
    if (!entry) throw new ApiError('Missing linked entry', 409, 'OCCURRENCE_MISSING_ENTRY')
    const household = await client('households').where({ id: device!.householdId }).first()
    const rows = await listOccurrences(
      client,
      device!.householdId,
      householdDate(new Date(), household.time_zone)
    )
    const row = rows.find((item) => item.id === params.id)
    if (!row) throw new ApiError('Occurrence not found', 404, 'OCCURRENCE_NOT_FOUND')
    return {
      data: {
        ...occurrenceResource(row),
        entry: {
          id: entry.id,
          amountCents: Number(entry.amount_cents),
          entryDate: entry.entry_date,
          revision: Number(entry.revision),
        },
      },
    }
  }
}
