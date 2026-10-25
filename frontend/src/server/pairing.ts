import '@tanstack/react-start/server-only'
import { PairingLimiter } from './security'
import { ApiFailure } from './transport'
const limiter = new PairingLimiter()
export function pairingAttempt() {
  try {
    limiter.attempt(Date.now())
  } catch {
    throw new ApiFailure('TOO_MANY_REQUESTS', 429)
  }
}
