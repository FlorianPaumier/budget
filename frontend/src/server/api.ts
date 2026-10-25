import '@tanstack/react-start/server-only'
import type { z } from 'zod'
import type { Registry } from '../../../backend/.adonisjs/client/registry/schema'
import type { ApiData } from '../lib/api.types'
import { getEnv } from './env'
import { requireSession } from './session'
import { requestApi, ApiFailure } from './transport'
import { endpoint } from './endpoint'
import type { EndpointArgs } from './endpoint'
export async function apiRequest<
  Name extends keyof Registry,
  T extends ApiData<Name>,
>(name: Name, args: EndpointArgs<Name>, schema: z.ZodType<T>): Promise<T> {
  const current = await requireSession()
  const { path, options } = endpoint(name, args)
  try {
    return await requestApi(
      { origin: getEnv().BUDGET_API_URL, credential: current.data.credential },
      path,
      options,
      schema,
    )
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 401)
      await current.clear()
    throw error
  }
}
