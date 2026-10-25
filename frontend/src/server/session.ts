import '@tanstack/react-start/server-only'
import {
  getCookie,
  setCookie,
  deleteCookie,
} from '@tanstack/react-start/server'
import { sealData } from 'iron-session'
import { decodeSession, sessionDataSchema } from './session-data'
import type { SessionData } from './session-data'
import { getEnv } from './env'
export async function session() {
  const env = getEnv(),
    production = env.NODE_ENV === 'production'
  const name = production ? '__Host-budget-session' : 'budget-dev-session'
  const options = {
    httpOnly: true,
    secure: production,
    sameSite: 'lax' as const,
    path: '/',
  }
  const data = await decodeSession(
    getCookie(name),
    env.SESSION_SECRET,
    Date.now(),
  )
  return {
    data,
    async clear() {
      deleteCookie(name, options)
    },
    async update(value: SessionData) {
      const valid = sessionDataSchema.parse(value)
      setCookie(
        name,
        await sealData(valid, { password: env.SESSION_SECRET, ttl: 7 * 86400 }),
        { ...options, maxAge: 7 * 86400 },
      )
    },
  }
}
export async function requireSession() {
  const current = await session()
  if (!current.data.credential) {
    await current.clear()
    throw new Error('UNAUTHORIZED')
  }
  return current
}
