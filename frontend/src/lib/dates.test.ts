import { expect, it } from 'vitest'
import {
  householdToday,
  shiftMonth,
  monthEnd,
  activityThrough,
  validMonth,
  validDate,
} from './dates'
it('uses the household date rather than UTC', () =>
  expect(
    householdToday(new Date('2026-01-01T02:00:00Z'), 'America/Toronto'),
  ).toBe('2025-12-31'))
it('moves across years', () =>
  expect(shiftMonth('2026-01', -1)).toBe('2025-12'))
it('knows leap month endings', () =>
  expect(monthEnd('2028-02')).toBe('2028-02-29'))
it('rejects nonexistent dates and months', () => {
  expect(validDate('2026-02-30')).toBe(false)
  expect(validMonth('2026-13')).toBe(false)
})
it('cuts current, past, future periods correctly', () => {
  expect(activityThrough('2026-10', '2026-10-15')).toBe('2026-10-15')
  expect(activityThrough('2026-09', '2026-10-15')).toBe('2026-09-30')
  expect(activityThrough('2026-11', '2026-10-15')).toBe('2026-10-15')
})
