import { afterEach, expect, it, vi } from 'vitest'
import { requestApi, ApiFailure } from './transport'
import { z } from 'zod'
afterEach(() => vi.unstubAllGlobals())
const config = {
  origin: 'http://127.0.0.1:3333',
  credential: 'private-test-token',
}
it('unwraps valid API responses and handles 204', async () => {
  vi.stubGlobal('fetch', async () => Response.json({ data: { value: 12 } }))
  expect(
    await requestApi(config, '/health', {}, z.object({ value: z.number() })),
  ).toEqual({ value: 12 })
  vi.stubGlobal('fetch', async () => new Response(null, { status: 204 }))
  expect(
    await requestApi(config, '/entries/abc', { method: 'DELETE' }, z.null()),
  ).toBeNull()
})
it('rejects redirects, arbitrary paths, and malformed responses', async () => {
  vi.stubGlobal('fetch', async () => new Response(null, { status: 302 }))
  await expect(
    requestApi(config, '/household', {}, z.object({ id: z.string() })),
  ).rejects.toMatchObject({ status: 502 })
  await expect(
    requestApi(config, 'https://evil.test', {}, z.unknown()),
  ).rejects.toThrow()
  vi.stubGlobal('fetch', async () =>
    Response.json({ data: { value: 'wrong' } }),
  )
  await expect(
    requestApi(config, '/health', {}, z.object({ value: z.number() })),
  ).rejects.toMatchObject({ status: 502 })
})
it('preserves structured validation details without exposing raw errors', async () => {
  vi.stubGlobal('fetch', async () =>
    Response.json(
      {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'amountCents', message: 'bad' }],
      },
      { status: 422 },
    ),
  )
  await expect(
    requestApi(config, '/entries', { method: 'POST' }, z.unknown()),
  ).rejects.toMatchObject({
    status: 422,
    code: 'VALIDATION_ERROR',
    fieldErrors: { amountCents: 'bad' },
  })
})
it('reports uncertain writes without retrying', async () => {
  let count = 0
  vi.stubGlobal('fetch', async () => {
    count++
    throw new Error('secret network internals')
  })
  try {
    await requestApi(config, '/entries', { method: 'POST' }, z.unknown())
  } catch (error) {
    expect(error).toBeInstanceOf(ApiFailure)
    expect(error).toMatchObject({ outcomeUncertain: true })
    expect(String(error)).not.toContain('secret network internals')
  }
  expect(count).toBe(1)
})
it('isolates concurrent credentials at the transport boundary', async () => {
  vi.stubGlobal('fetch', async (_url: unknown, options: RequestInit) => {
    await new Promise((resolve) => setTimeout(resolve, 2))
    return Response.json({
      data: { actor: new Headers(options.headers).get('Authorization') },
    })
  })
  const schema = z.object({ actor: z.string() })
  const [a, b] = await Promise.all([
    requestApi({ ...config, credential: 'a' }, '/household', {}, schema),
    requestApi({ ...config, credential: 'b' }, '/household', {}, schema),
  ])
  expect(a.actor).toBe('Bearer a')
  expect(b.actor).toBe('Bearer b')
})
