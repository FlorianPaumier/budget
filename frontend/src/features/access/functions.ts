import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { session, requireSession } from '../../server/session'
import { getEnv } from '../../server/env'
import { requestApi } from '../../server/transport'
import { apiRequest } from '../../server/api'
import { result } from '../../server/result'
import { pairingAttempt } from '../../server/pairing'
import { householdSchema } from '../../lib/schemas'

export const inspectSession = createServerFn({ method: 'GET' }).handler(
  async () => {
    const current = await session()
    if (
      !current.data.credential ||
      !current.data.expiresAt ||
      current.data.expiresAt <= Date.now()
    ) {
      await current.clear()
      return null
    }
    const response = await result(() =>
      apiRequest('households.show', {}, householdSchema),
    )
    if (!response.ok) {
      if (response.error.status === 401) return null
      return {
        deviceId: current.data.deviceId!,
        householdId: current.data.householdId!,
      }
    }
    return { deviceId: current.data.deviceId!, householdId: response.value.id }
  },
)
export const pair = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      pairingCode: z.string().min(32).max(256),
      label: z.string().trim().min(1).max(120),
    }),
  )
  .handler(async ({ data }) =>
    result(async () => {
      pairingAttempt()
      const paired = await requestApi(
        { origin: getEnv().BUDGET_API_URL },
        '/pair',
        { method: 'POST', body: JSON.stringify(data) },
        z.object({
          credential: z.string().min(32),
          deviceId: z.uuid(),
          householdId: z.uuid(),
        }),
      )
      const current = await session()
      await current.clear()
      await current.update({ ...paired, expiresAt: Date.now() + 7 * 86400_000 })
      return { householdId: paired.householdId }
    }),
  )
export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  const current = await session()
  let revoked = true
  try {
    const auth = await requireSession()
    await apiRequest(
      'devices.destroy',
      { params: { id: auth.data.deviceId! } },
      z.null(),
    )
  } catch {
    revoked = false
  } finally {
    await current.clear()
  }
  return { revoked }
})
