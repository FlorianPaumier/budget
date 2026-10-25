// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { Feedback } from './feedback'
import { RequestFailure } from '../../lib/errors'
afterEach(cleanup)
it('shows French field labels without exposing API field names', () => {
  render(
    <Feedback
      error={
        new RequestFailure({
          code: 'VALIDATION_ERROR',
          status: 422,
          fieldErrors: { amountCents: 'internal diagnostic' },
          outcomeUncertain: false,
        })
      }
    />,
  )
  const alert = screen.getByRole('alert')
  expect(alert.textContent).toContain('Montant')
  expect(alert.textContent).not.toContain('amountCents')
  expect(alert.textContent).not.toContain('internal diagnostic')
})
it('explains uncertain writes rather than claiming they failed', () => {
  render(
    <Feedback
      error={
        new RequestFailure({
          code: 'API_UNAVAILABLE',
          status: 503,
          fieldErrors: {},
          outcomeUncertain: true,
        })
      }
    />,
  )
  expect(screen.getByRole('alert').textContent).toContain('incertain')
})
