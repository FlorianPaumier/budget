import type { z } from 'zod'
import type { ApiData } from '../../src/lib/api.types'
import type * as schemas from '../../src/lib/schemas'
import { endpoint } from '../../src/server/endpoint'
// These compile-time checks fail if the generated contract loses its constraints.
export function assertGeneratedContract() {
  // @ts-expect-error Adonis has no arbitrary route names.
  endpoint('entries.missing', {})
  endpoint('entries.update', {
    params: { id: 'entry' },
    // @ts-expect-error Adonis requires a revision for entry corrections.
    body: { note: 'changed' },
  })
  // @ts-expect-error Adonis requires the entry ID route parameter.
  endpoint('entries.show', {})
}

type Assert<Condition extends true> = Condition
type SameKeys<A, B> = [keyof A] extends [keyof B]
  ? [keyof B] extends [keyof A]
    ? true
    : false
  : false
export type DecoderContractChecks = [
  Assert<
    SameKeys<z.infer<typeof schemas.entrySchema>, ApiData<'entries.show'>>
  >,
  Assert<
    SameKeys<
      z.infer<typeof schemas.householdSchema>,
      ApiData<'households.show'>
    >
  >,
  Assert<
    SameKeys<z.infer<typeof schemas.balancesSchema>, ApiData<'balances.show'>>
  >,
  Assert<
    SameKeys<z.infer<typeof schemas.actualsSchema>, ApiData<'balances.actuals'>>
  >,
  Assert<
    SameKeys<z.infer<typeof schemas.planSchema>, ApiData<'monthly_plans.show'>>
  >,
  Assert<
    SameKeys<
      z.infer<typeof schemas.estimateSchema>,
      ApiData<'monthly_plans.set_estimate'>
    >
  >,
  Assert<
    SameKeys<
      z.infer<typeof schemas.targetSchema>,
      ApiData<'monthly_plans.set_savings_target'>
    >
  >,
  Assert<
    SameKeys<
      z.infer<typeof schemas.suggestionSchema>,
      ApiData<'monthly_plans.suggestion'>
    >
  >,
  Assert<
    SameKeys<
      z.infer<typeof schemas.categorySchema>,
      ApiData<'categories.index'>[number]
    >
  >,
  Assert<
    SameKeys<
      z.infer<typeof schemas.historySchema>,
      ApiData<'entries.history'>[number]
    >
  >,
  Assert<
    SameKeys<
      z.infer<typeof schemas.ruleSchema>,
      ApiData<'recurring_rules.show'>
    >
  >,
  Assert<
    SameKeys<
      z.infer<typeof schemas.occurrenceSchema>,
      ApiData<'occurrences.index'>[number]
    >
  >,
  Assert<
    SameKeys<
      z.infer<typeof schemas.deviceSchema>,
      ApiData<'devices.index'>[number]
    >
  >,
]
