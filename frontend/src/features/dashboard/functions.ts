import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { apiRequest } from '../../server/api'
import { result } from '../../server/result'
import {
  actualsSchema,
  balancesSchema,
  categorySchema,
  entrySchema,
  householdSchema,
  month,
  planSchema,
} from '../../lib/schemas'
import { activityThrough, householdToday } from '../../lib/dates'
export const getHousehold = createServerFn({ method: 'GET' }).handler(() =>
  result(() => apiRequest('households.show', {}, householdSchema)),
)
export const getMonth = createServerFn({ method: 'GET' })
  .validator(z.object({ month }))
  .handler(({ data }) =>
    result(async () => {
      const household = await apiRequest('households.show', {}, householdSchema)
      const today = householdToday(new Date(), household.timeZone)
      const through = activityThrough(data.month, today)
      const [balances, actuals, plan, entries, categories] = await Promise.all([
        apiRequest(
          'balances.show',
          { query: { asOf: through } },
          balancesSchema,
        ),
        apiRequest(
          'balances.actuals',
          { params: { month: data.month }, query: { today: through } },
          actualsSchema,
        ),
        apiRequest(
          'monthly_plans.show',
          { params: { month: data.month } },
          planSchema,
        ),
        apiRequest(
          'entries.index',
          { query: { month: data.month } },
          z.array(entrySchema),
        ),
        apiRequest('categories.index', {}, z.array(categorySchema)),
      ])
      return {
        household,
        today,
        through,
        balances,
        actuals,
        plan,
        entries,
        categories,
      }
    }),
  )
