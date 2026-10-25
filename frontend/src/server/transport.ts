import type { z } from 'zod'
export class ApiFailure extends Error {
  constructor(
    public code: string,
    public status: number,
    public fieldErrors: Record<string, string> = {},
    public outcomeUncertain = false,
  ) {
    super(code)
  }
}
export async function requestApi<T>(
  config: { origin: string; credential?: string },
  path: string,
  options: RequestInit,
  schema: z.ZodType<T>,
): Promise<T> {
  if (
    !/^\/[a-z0-9/?=&_-]+$/i.test(path) ||
    path.startsWith('//') ||
    path.includes('..')
  )
    throw new ApiFailure('INVALID_PATH', 400)
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (options.body) headers.set('Content-Type', 'application/json')
  if (config.credential)
    headers.set('Authorization', `Bearer ${config.credential}`)
  const mutation = !!options.method && !['GET', 'HEAD'].includes(options.method)
  let response: Response
  try {
    response = await fetch(`${config.origin}/api/v1${path}`, {
      ...options,
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw new ApiFailure('API_UNAVAILABLE', 503, {}, mutation)
  }
  if (response.status >= 300 && response.status < 400)
    throw new ApiFailure('UPSTREAM_REDIRECT', 502, {}, mutation)
  let body: unknown
  try {
    body = response.status === 204 ? null : await response.json()
  } catch {
    throw new ApiFailure('INVALID_RESPONSE', 502, {}, mutation)
  }
  if (!response.ok) {
    const error = body as {
      code?: unknown
      details?: { field?: string; message?: string }[]
    } | null
    const fields: Record<string, string> = {}
    if (Array.isArray(error?.details))
      for (const detail of error.details)
        if (
          typeof detail.field === 'string' &&
          typeof detail.message === 'string'
        )
          fields[detail.field] = detail.message
    throw new ApiFailure(
      typeof error?.code === 'string' ? error.code : 'API_ERROR',
      response.status,
      fields,
      mutation && response.status >= 500,
    )
  }
  const result = schema.safeParse(
    response.status === 204 ? null : (body as { data?: unknown })?.data,
  )
  if (!result.success)
    throw new ApiFailure('INVALID_RESPONSE', 502, {}, mutation)
  return result.data
}
