import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { errors as vineErrors } from '@vinejs/vine'
import { ApiError } from '#exceptions/api_error'
import { listChanges, listConflicts, pushOperation, resolveConflict } from '#services/sync'
import {
  changesValidator,
  pushValidator,
  resolveValidator,
  validateSyncOperation,
} from '#validators/sync'

export default class SyncController {
  async push({ device, request, logger }: HttpContext) {
    const { operations, generation } = await request.validateUsing(pushValidator)
    const household = await db.from('households').where({ id: device!.householdId }).first()
    if (generation && generation !== household.sync_generation)
      throw new ApiError('Sync history changed; refresh before retrying', 409, 'SYNC_RESET')
    const outcomes = []
    for (const input of operations) {
      let operationId: string | null = null
      if (input && typeof input === 'object' && typeof input.operationId === 'string')
        operationId = input.operationId
      try {
        const operation = await validateSyncOperation(input)
        outcomes.push(
          await pushOperation(
            db.connection().getWriteClient(),
            device!.householdId,
            device!.id,
            operation
          )
        )
      } catch (error) {
        if (error instanceof vineErrors.E_VALIDATION_ERROR) {
          outcomes.push({
            operationId,
            status: 'rejected',
            code: 'VALIDATION_ERROR',
            details: error.messages,
          })
        } else if (error instanceof ApiError && error.status < 500) {
          outcomes.push({
            operationId,
            status: 'rejected',
            code: error.code,
            message: error.message,
          })
        } else if (
          error instanceof Error &&
          'code' in error &&
          error.code === 'SQLITE_CONSTRAINT_UNIQUE'
        ) {
          outcomes.push({
            operationId,
            status: 'rejected',
            code: 'DUPLICATE_RESOURCE',
            message: 'A record with these unique values already exists',
          })
        } else if (
          error instanceof Error &&
          !('code' in error) &&
          /^(Invalid |Unsupported |Create must |Update requires |Occurrences can only |Household settings can only |Monthly plans cannot |Value required|Operation ID already |Estimate ID does not |Plan ID does not |Amount must |Account required|Account only allowed|Transfer cannot |Note too long|Edit recurring entries|Delete recurring entries|Revision conflict$|(Category|Entry|Rule|Occurrence|Household) not found$)/.test(
            error.message
          )
        ) {
          outcomes.push({
            operationId,
            status: 'rejected',
            code: 'INVALID_OPERATION',
            message: error.message,
          })
        } else {
          logger.error({ err: error }, 'Sync operation failed')
          throw error
        }
      }
    }
    return { data: { outcomes } }
  }

  async changes({ device, request }: HttpContext) {
    const { cursor, limit } = await request.validateUsing(changesValidator)
    const household = await db.from('households').where({ id: device!.householdId }).first()
    return {
      data: {
        ...(await listChanges(
          db.connection().getReadClient(),
          device!.householdId,
          cursor ?? 0,
          limit ?? 100
        )),
        generation: household.sync_generation,
      },
    }
  }

  async conflicts({ device }: HttpContext) {
    return {
      data: {
        conflicts: await listConflicts(db.connection().getReadClient(), device!.householdId),
      },
    }
  }

  async resolve({ device, request }: HttpContext) {
    const { params, choice, serverRevision, generation } =
      await request.validateUsing(resolveValidator)
    const household = await db.from('households').where({ id: device!.householdId }).first()
    if (generation && generation !== household.sync_generation)
      throw new ApiError('Sync history changed; refresh before retrying', 409, 'SYNC_RESET')
    return {
      data: await resolveConflict(
        db.connection().getWriteClient(),
        device!.householdId,
        device!.id,
        params.id,
        choice,
        serverRevision
      ),
    }
  }
}
