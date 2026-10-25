import { z } from 'zod'
import { unsealData } from 'iron-session'
export const sessionDataSchema = z.object({
  credential: z.string().min(32),
  deviceId: z.uuid(),
  householdId: z.uuid(),
  expiresAt: z.number(),
})
export type SessionData = Partial<z.infer<typeof sessionDataSchema>>
export async function decodeSession(
  raw: string | undefined,
  password: string,
  now: number,
): Promise<SessionData> {
  if (!raw) return {}
  try {
    const parsed = sessionDataSchema.safeParse(
      await unsealData(raw, { password, ttl: 7 * 86400 }),
    )
    return parsed.success && parsed.data.expiresAt > now ? parsed.data : {}
  } catch {
    return {}
  }
}
