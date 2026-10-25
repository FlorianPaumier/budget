import { z } from 'zod'
export function readEnv(source: Record<string, string | undefined>) {
  const schema = z.object({
    SESSION_SECRET: z.string().min(32),
    WEB_ORIGIN: z.url(),
    BUDGET_API_URL: z.url(),
    NODE_ENV: z.string().optional(),
  })
  const env = schema.parse(source)
  for (const name of ['WEB_ORIGIN', 'BUDGET_API_URL'] as const) {
    const url = new URL(env[name])
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.origin !== env[name]
    )
      throw new Error(`Invalid ${name}`)
  }
  if (env.NODE_ENV === 'production' && !env.WEB_ORIGIN.startsWith('https://'))
    throw new Error('Production requires HTTPS')
  return env
}
export function checkOrigin(origin: string | null, expected: string) {
  if (origin !== expected) throw new Error('FORBIDDEN_ORIGIN')
}
// shortcut: one server process shares five pairing attempts per minute; use a shared limiter if scaled out.
export class PairingLimiter {
  private count = 0
  private since = 0
  attempt(now: number) {
    if (now - this.since > 60_000) {
      this.count = 0
      this.since = now
    }
    if (++this.count > 5) throw new Error('TOO_MANY_REQUESTS')
  }
}
