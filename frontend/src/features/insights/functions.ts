import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { apiRequest } from '../../server/api'
import { result } from '../../server/result'
import { entrySchema, householdSchema, month } from '../../lib/schemas'
import { householdToday } from '../../lib/dates'
import { insightRange } from './range'
import { insightPeriod } from '../../lib/schemas'
export const getInsightEntries = createServerFn({ method: 'GET' })
  .validator(z.object({ month, period: insightPeriod }))
  .handler(({ data }) =>
    result(async () => {
      const household = await apiRequest('households.show', {}, householdSchema)
      const range = insightRange(
        data.month,
        data.period,
        householdToday(new Date(), household.timeZone),
      )
      const pages = await Promise.all(
        range.months.map((month) =>
          apiRequest(
            'entries.index',
            { query: { month } },
            z.array(entrySchema),
          ),
        ),
      )
      return {
        ...range,
        entries: pages
          .flat()
          .filter(
            (entry) =>
              entry.entryDate >= range.from && entry.entryDate <= range.through,
          ),
      }
    }),
  )
