import app from '@adonisjs/core/services/app'
import { type HttpContext, ExceptionHandler } from '@adonisjs/core/http'
import { errors as vineErrors } from '@vinejs/vine'
import { ApiError } from './api_error.js'

export default class HttpExceptionHandler extends ExceptionHandler {
  /**
   * In debug mode, the exception handler will display verbose errors
   * with pretty printed stack traces.
   */
  protected debug = !app.inProduction

  /**
   * The method is used for handling errors and returning
   * response to the client
   */
  async handle(error: unknown, ctx: HttpContext) {
    if (error instanceof vineErrors.E_VALIDATION_ERROR) {
      return ctx.response.unprocessableEntity({ code: 'VALIDATION_ERROR', details: error.messages })
    }
    if (error instanceof ApiError) {
      return ctx.response.status(error.status).send({ code: error.code, message: error.message })
    }
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'SQLITE_CONSTRAINT_UNIQUE'
    ) {
      return ctx.response.conflict({
        code: 'DUPLICATE_RESOURCE',
        message: 'A record with these unique values already exists',
      })
    }
    // Adapt existing service errors without exposing SQL or unexpected runtime failures.
    if (error instanceof Error) {
      if (/^(Category|Entry|Rule|Occurrence|Household|Conflict) not found$/.test(error.message)) {
        return ctx.response.notFound({ code: 'NOT_FOUND', message: error.message })
      }
      if (error.message === 'Revision conflict') {
        return ctx.response.conflict({ code: 'REVISION_CONFLICT', message: error.message })
      }
      if (
        /^(Invalid |Amount must |Account required|Account only allowed|Transfer cannot|Note too long|Edit recurring entries|Delete recurring entries|Balance exceeds)/.test(
          error.message
        )
      ) {
        return ctx.response.unprocessableEntity({
          code: 'VALIDATION_ERROR',
          message: error.message,
        })
      }
    }
    const status =
      typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 500
    if (status >= 400 && status < 500) {
      const codes: Record<number, string> = {
        400: 'BAD_REQUEST',
        401: 'UNAUTHORIZED',
        403: 'FORBIDDEN',
        404: 'NOT_FOUND',
        413: 'PAYLOAD_TOO_LARGE',
        415: 'UNSUPPORTED_MEDIA_TYPE',
        422: 'VALIDATION_ERROR',
        429: 'TOO_MANY_REQUESTS',
      }
      return ctx.response.status(status).send({ code: codes[status] ?? 'REQUEST_FAILED' })
    }
    return ctx.response.internalServerError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Unable to process this request',
    })
  }

  /**
   * The method is used to report error to the logging service or
   * the a third party error monitoring service.
   *
   * @note You should not attempt to send a response from this method.
   */
  async report(error: unknown, ctx: HttpContext) {
    return super.report(error, ctx)
  }
}
