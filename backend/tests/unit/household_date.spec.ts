import { test } from '@japa/runner'

test('opening date follows the household time zone near UTC midnight', async ({ assert }) => {
  const { householdDate } = await import('../../app/services/household_date.js')
  assert.equal(householdDate(new Date('2026-10-01T01:00:00.000Z'), 'America/Toronto'), '2026-09-30')
})
