import { expect, it } from 'vitest'
import { readEnv, checkOrigin, PairingLimiter } from './security'
it('rejects missing secrets and untrusted configuration', () => {
  expect(() => readEnv({})).toThrow()
  expect(() =>
    readEnv({
      SESSION_SECRET: 'x'.repeat(32),
      WEB_ORIGIN: 'https://budget.test/path',
      BUDGET_API_URL: 'http://localhost:3333',
    }),
  ).toThrow()
})
it('accepts the configured origin only', () => {
  expect(() =>
    checkOrigin('https://evil.test', 'https://budget.test'),
  ).toThrow()
  expect(() => checkOrigin(null, 'https://budget.test')).toThrow()
  expect(() =>
    checkOrigin('http://budget.test', 'https://budget.test'),
  ).toThrow()
  expect(() =>
    checkOrigin('https://budget.test', 'https://budget.test'),
  ).not.toThrow()
})
it('limits pairing and releases capacity after the window', () => {
  const limiter = new PairingLimiter()
  for (let i = 0; i < 5; i++) limiter.attempt(0)
  expect(() => limiter.attempt(0)).toThrow()
  expect(() => limiter.attempt(60001)).not.toThrow()
})
