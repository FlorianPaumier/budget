import '@tanstack/react-start/server-only'
import type { Result } from '../lib/errors'
import { ApiFailure } from './transport'
export async function result<T>(
  operation: () => Promise<T>,
): Promise<Result<T>> {
  try {
    return { ok: true, value: await operation() }
  } catch (error) {
    if (error instanceof ApiFailure)
      return {
        ok: false,
        error: {
          code: error.code,
          status: error.status,
          fieldErrors: error.fieldErrors,
          outcomeUncertain: error.outcomeUncertain,
        },
      }
    return {
      ok: false,
      error: {
        code: 'REQUEST_FAILED',
        status:
          error instanceof Error && error.message === 'UNAUTHORIZED'
            ? 401
            : 503,
        fieldErrors: {},
        outcomeUncertain: false,
      },
    }
  }
}
