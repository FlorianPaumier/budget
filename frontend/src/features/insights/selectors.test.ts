import { expect, it } from 'vitest'
import { summarize } from './selectors'
import { entryInputSchema } from '../../lib/schemas'
const base = {
  id: 'a',
  entryDate: '2026-10-01',
  amountCents: 100,
  categoryId: 'food',
  account: null,
  note: null,
  occurrenceId: null,
  revision: 1,
  deletedAt: null,
}
it('counts category adjustments as spending and excludes transfers from earnings', () => {
  const result = summarize(
    [
      { ...base, kind: 'income', amountCents: 1000 },
      { ...base, id: 'b', kind: 'expense', amountCents: 200 },
      { ...base, id: 'c', kind: 'category_adjustment', amountCents: 50 },
      { ...base, id: 'd', kind: 'savings_transfer', amountCents: 300 },
    ],
    '2026-10-15',
  )
  expect(result).toEqual({
    incomeCents: 1000,
    spendingCents: 250,
    byCategory: { food: 250 },
  })
})
it('excludes future activity and deleted records', () =>
  expect(
    summarize(
      [
        { ...base, kind: 'expense', entryDate: '2026-10-30' },
        { ...base, kind: 'expense', deletedAt: '2026-10-02' },
      ],
      '2026-10-15',
    ).spendingCents,
  ).toBe(0))
it('validates manual financial constraints', () => {
  const valid = {
    kind: 'expense',
    entryDate: '2026-10-01',
    amountCents: 1234,
    categoryId: null,
    note: null,
  }
  expect(entryInputSchema.safeParse(valid).success).toBe(true)
  expect(
    entryInputSchema.safeParse({ ...valid, amountCents: -1 }).success,
  ).toBe(false)
  expect(
    entryInputSchema.safeParse({ ...valid, kind: 'balance_adjustment' })
      .success,
  ).toBe(false)
  expect(
    entryInputSchema.safeParse({
      ...valid,
      kind: 'savings_transfer',
      categoryId: 'bb5454a6-ea2c-40fa-8761-05b835703d58',
    }).success,
  ).toBe(false)
})
