import { z } from 'zod'
import { validDate, validMonth } from './dates'
import type { ApiData, ApiBody } from './api.types'
type ApiEntry = ApiData<'entries.show'>
export const uuid = z.uuid()
export const cents = z.number().int().safe()
export const revision = z.number().int().positive()
export const date = z.string().refine(validDate, 'Date invalide.')
export const month = z.string().refine(validMonth, 'Mois invalide.')
export const entryKind = z.enum([
  'income',
  'expense',
  'category_adjustment',
  'savings_transfer',
  'balance_adjustment',
])
export const categorySchema = z.object({
  id: uuid,
  name: z.string(),
  active: z.boolean(),
  revision,
  deletedAt: z.string().nullable(),
}) satisfies z.ZodType<ApiData<'categories.index'>[number]>
export const entrySchema = z.object({
  id: uuid,
  kind: entryKind,
  entryDate: date,
  amountCents: cents,
  categoryId: uuid.nullable(),
  account: z.enum(['spendable', 'savings']).nullable(),
  note: z.string().nullable(),
  occurrenceId: uuid.nullable(),
  revision,
  deletedAt: z.string().nullable(),
}) satisfies z.ZodType<ApiEntry>
export const householdSchema = z.object({
  id: uuid,
  currency: z.literal('CAD'),
  timeZone: z.string(),
  reminderTime: z.string(),
  openingSpendableCents: cents,
  openingSavingsCents: cents,
  openingDate: date,
  monthlySavingsTargetCents: cents.nullable(),
  revision,
}) satisfies z.ZodType<ApiData<'households.show'>>
export const balancesSchema = z.object({
  spendableCents: cents,
  savingsCents: cents,
  combinedCents: cents,
}) satisfies z.ZodType<ApiData<'balances.show'>>
export const actualsSchema = z.object({
  incomeCents: cents,
  spendingCents: cents,
  transferToSavingsCents: cents,
  moneyLeftTodayCents: cents,
}) satisfies z.ZodType<ApiData<'balances.actuals'>>
export const estimateSchema = z.object({
  id: uuid,
  categoryId: uuid,
  month,
  amountCents: cents,
  revision,
}) satisfies z.ZodType<ApiData<'monthly_plans.set_estimate'>>
export const targetSchema = z.object({
  id: uuid,
  month,
  amountCents: cents.nullable(),
  revision,
}) satisfies z.ZodType<ApiData<'monthly_plans.set_savings_target'>>
export const planSchema = z.object({
  month,
  openingSpendableCents: cents,
  expectedIncomeCents: cents,
  expectedBillsCents: cents,
  estimateCents: cents,
  savingsTargetCents: cents,
  moneyLeftCents: cents,
  estimates: z.array(estimateSchema),
  savingsTarget: targetSchema.nullable(),
}) satisfies z.ZodType<ApiData<'monthly_plans.show'>>
export const suggestionSchema = z.object({
  categoryId: uuid,
  month,
  amountCents: cents.nullable(),
  sampleCount: z.number().int().nonnegative(),
}) satisfies z.ZodType<ApiData<'monthly_plans.suggestion'>>
export const historySchema = z.object({
  id: uuid,
  deviceId: uuid.nullable(),
  deviceLabel: z.string().nullable(),
  beforeRevision: z.number().nullable(),
  afterRevision: z.number(),
  createdAt: z.string(),
  before: entrySchema.nullable(),
  after: entrySchema.nullable(),
}) satisfies z.ZodType<ApiData<'entries.history'>[number]>
export const ruleFields = {
  kind: z.enum(['income', 'bill', 'subscription']),
  name: z.string().trim().min(1).max(160),
  categoryId: uuid.nullable(),
  amountCents: cents.positive(),
  frequency: z.enum([
    'daily',
    'weekly',
    'biweekly',
    'twice_monthly',
    'monthly',
    'yearly',
  ]),
  interval: z.number().int().min(1).max(1000),
  startsOn: date,
  endsOn: date.nullable(),
  scheduleDetails: z
    .object({
      days: z.tuple([
        z.number().int().min(1).max(31),
        z.number().int().min(1).max(31),
      ]),
    })
    .nullable(),
}
export const ruleInputSchema = z
  .object(ruleFields)
  .refine((v) => !v.endsOn || v.endsOn >= v.startsOn, {
    message: 'La fin précède le début.',
    path: ['endsOn'],
  })
  .refine(
    (v) =>
      v.frequency !== 'twice_monthly' ||
      (!!v.scheduleDetails &&
        v.scheduleDetails.days[0] !== v.scheduleDetails.days[1]),
    { message: 'Choisissez deux jours distincts.', path: ['scheduleDetails'] },
  )
export const ruleSchema = z.object({
  ...ruleFields,
  id: uuid,
  active: z.boolean(),
  revision,
}) satisfies z.ZodType<ApiData<'recurring_rules.show'>>
export const occurrenceSchema = z.object({
  id: uuid,
  ruleId: uuid,
  ruleName: z.string(),
  ruleKind: z.string(),
  expectedDate: date,
  expectedAmountCents: cents,
  status: z.string(),
  displayStatus: z.string(),
  actualDate: date.nullable(),
  actualAmountCents: cents.nullable(),
  confirmationMethod: z.string().nullable(),
  needsReview: z.boolean(),
  revision,
}) satisfies z.ZodType<ApiData<'occurrences.index'>[number]>
export const deviceSchema = z.object({
  id: uuid,
  label: z.string(),
  pairedAt: z.string(),
  revokedAt: z.string().nullable(),
}) satisfies z.ZodType<ApiData<'devices.index'>[number]>
export const entryInputSchema = z
  .object({
    kind: entryKind,
    entryDate: date,
    amountCents: cents,
    categoryId: uuid.nullable(),
    account: z.enum(['spendable', 'savings']).optional(),
    note: z.string().max(500).nullable(),
  })
  .superRefine((v, ctx) => {
    if (
      v.amountCents === 0 ||
      (!['savings_transfer', 'balance_adjustment'].includes(v.kind) &&
        v.amountCents < 0)
    )
      ctx.addIssue({
        code: 'custom',
        path: ['amountCents'],
        message: 'Le montant doit être positif et non nul.',
      })
    if (v.kind === 'savings_transfer' && v.categoryId)
      ctx.addIssue({
        code: 'custom',
        path: ['categoryId'],
        message: 'Un transfert ne peut pas avoir de catégorie.',
      })
    if ((v.kind === 'balance_adjustment') !== !!v.account)
      ctx.addIssue({
        code: 'custom',
        path: ['account'],
        message: 'Le compte est réservé aux ajustements de solde.',
      })
  }) satisfies z.ZodType<ApiBody<'entries.store'>>
export type Category = z.infer<typeof categorySchema>
export type Household = z.infer<typeof householdSchema>
export type Plan = z.infer<typeof planSchema>
export type Rule = z.infer<typeof ruleSchema>
export type Occurrence = z.infer<typeof occurrenceSchema>

export type Entry = z.infer<typeof entrySchema>

export const insightPeriod = z.enum(['month', 'week', 'quarter', 'year'])
