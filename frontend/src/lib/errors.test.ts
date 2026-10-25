import { expect, it } from 'vitest'
import { performMutation } from './errors'
it('treats a lost browser RPC response as an uncertain write', async () => {
  await expect(
    performMutation(async () => {
      throw new TypeError('Failed to fetch')
    }),
  ).rejects.toMatchObject({ failure: { outcomeUncertain: true, status: 503 } })
})
it('preserves a known revision conflict as a rejected write', async () => {
  await expect(
    performMutation(async () => ({
      ok: false as const,
      error: {
        code: 'REVISION_CONFLICT',
        status: 409,
        fieldErrors: {},
        outcomeUncertain: false,
      },
    })),
  ).rejects.toMatchObject({ failure: { outcomeUncertain: false, status: 409 } })
  await expect(
    performMutation(async () => ({ ok: true as const, value: 123 })),
  ).resolves.toBe(123)
})
