import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { apiRequest } from '../../server/api'
import { result } from '../../server/result'
import {
  uuid,
  month,
  cents,
  estimateSchema,
  targetSchema,
  suggestionSchema,
} from '../../lib/schemas'
export const setEstimate = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      month,
      categoryId: uuid,
      amountCents: cents.nonnegative(),
      revision: z.number().int().nonnegative(),
    }),
  )
  .handler(({ data: { month, categoryId, ...body } }) =>
    result(() =>
      apiRequest(
        'monthly_plans.set_estimate',
        { params: { month, categoryId }, body },
        estimateSchema,
      ),
    ),
  )
export const setTarget = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      month,
      amountCents: cents.nonnegative().nullable(),
      revision: z.number().int().nonnegative(),
    }),
  )
  .handler(({ data: { month, ...body } }) =>
    result(() =>
      apiRequest(
        'monthly_plans.set_savings_target',
        { params: { month }, body },
        targetSchema,
      ),
    ),
  )
export const getSuggestion = createServerFn({ method: 'GET' })
  .validator(z.object({ month, categoryId: uuid }))
  .handler(({ data }) =>
    result(() =>
      apiRequest(
        'monthly_plans.suggestion',
        { params: { month: data.month, categoryId: data.categoryId } },
        suggestionSchema,
      ),
    ),
  )
