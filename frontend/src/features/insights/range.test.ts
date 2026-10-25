import { expect, it } from 'vitest'
import { insightRange } from './range'
it('uses rolling calendar months and household-date cutoffs', () => {
  expect(insightRange('2026-10', 'week', '2026-10-15')).toEqual({
    from: '2026-10-09',
    through: '2026-10-15',
    months: ['2026-10'],
  })
  expect(insightRange('2026-01', 'quarter', '2026-10-15')).toEqual({
    from: '2025-11-01',
    through: '2026-01-31',
    months: ['2025-11', '2025-12', '2026-01'],
  })
  expect(insightRange('2026-10', 'year', '2026-10-15').months).toHaveLength(12)
  expect(insightRange('2026-11', 'month', '2026-10-15').months).toEqual([])
})
