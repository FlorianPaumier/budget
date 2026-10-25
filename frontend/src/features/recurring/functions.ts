import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { apiRequest } from '../../server/api'
import { result } from '../../server/result'
import {
  uuid,
  date,
  revision,
  ruleInputSchema,
  ruleSchema,
  occurrenceSchema,
  cents,
} from '../../lib/schemas'
const range = z
  .object({ from: date, through: date })
  .refine((v) => v.from <= v.through, 'Période invalide.')
export const getRecurring = createServerFn({ method: 'GET' })
  .validator(range)
  .handler(({ data }) =>
    result(async () => {
      const [rules, occurrences] = await Promise.all([
        apiRequest('recurring_rules.index', {}, z.array(ruleSchema)),
        apiRequest(
          'occurrences.index',
          { query: data },
          z.array(occurrenceSchema),
        ),
      ])
      return { rules, occurrences }
    }),
  )
export const createRule = createServerFn({ method: 'POST' })
  .validator(ruleInputSchema)
  .handler(({ data }) =>
    result(() =>
      apiRequest('recurring_rules.store', { body: data }, ruleSchema),
    ),
  )
export const updateRule = createServerFn({ method: 'POST' })
  .validator(z.object({ id: uuid, revision, input: ruleInputSchema, range }))
  .handler(({ data }) =>
    result(() =>
      apiRequest(
        'recurring_rules.update',
        {
          params: { id: data.id },
          body: { ...data.input, ...data.range, revision: data.revision },
        },
        ruleSchema,
      ),
    ),
  )
export const deleteRule = createServerFn({ method: 'POST' })
  .validator(z.object({ id: uuid, revision, range }))
  .handler(({ data }) =>
    result(() =>
      apiRequest(
        'recurring_rules.destroy',
        {
          params: { id: data.id },
          body: { ...data.range, revision: data.revision },
        },
        z.null(),
      ),
    ),
  )
export const confirmOccurrence = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      id: uuid,
      revision,
      actualDate: date,
      actualAmountCents: cents.positive(),
    }),
  )
  .handler(({ data: { id, ...body } }) =>
    result(() =>
      apiRequest(
        'occurrences.confirm',
        { params: { id }, body },
        occurrenceSchema.extend({
          entry: z.object({
            id: uuid,
            amountCents: cents,
            entryDate: date,
            revision,
          }),
        }),
      ),
    ),
  )
