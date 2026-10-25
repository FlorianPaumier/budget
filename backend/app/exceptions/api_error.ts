import { Exception } from '@adonisjs/core/exceptions'

/** An expected domain failure with a stable public code. */
export class ApiError extends Exception {
  constructor(message: string, status: number, code: string) {
    super(message, { status, code })
  }
}
