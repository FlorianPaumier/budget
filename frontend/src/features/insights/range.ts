import type { z } from 'zod'
import type { insightPeriod } from '../../lib/schemas'
import {
  activityThrough,
  shiftMonth,
  validMonth,
  validDate,
} from '../../lib/dates'
export function insightRange(
  month: string,
  period: z.infer<typeof insightPeriod>,
  today: string,
) {
  if (!validMonth(month) || !validDate(today))
    throw new Error('Période invalide.')
  const through = activityThrough(month, today)
  let from = `${month}-01`
  if (month <= today.slice(0, 7)) {
    if (period === 'week') {
      const date = new Date(`${through}T12:00:00Z`)
      date.setUTCDate(date.getUTCDate() - 6)
      from = date.toISOString().slice(0, 10)
    } else if (period === 'quarter' || period === 'year')
      from = `${shiftMonth(month, period === 'quarter' ? -2 : -11)}-01`
  }
  const months: string[] = []
  if (from <= through)
    for (
      let cursor = from.slice(0, 7);
      cursor <= through.slice(0, 7);
      cursor = shiftMonth(cursor, 1)
    )
      months.push(cursor)
  return { from, through, months }
}
