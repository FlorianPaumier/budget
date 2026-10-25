import type { Entry } from '../../lib/schemas'
import { sumCents } from '../../lib/money'
export function summarize(entries: Entry[], through: string) {
  const accepted = entries.filter(
    (entry) => !entry.deletedAt && entry.entryDate <= through,
  )
  const spending = accepted.filter(
    (entry) => entry.kind === 'expense' || entry.kind === 'category_adjustment',
  )
  const byCategory: Record<string, number> = {}
  for (const entry of spending) {
    const key = entry.categoryId || 'uncategorized'
    byCategory[key] = sumCents([byCategory[key] || 0, entry.amountCents])
  }
  return {
    incomeCents: sumCents(
      accepted
        .filter((entry) => entry.kind === 'income')
        .map((e) => e.amountCents),
    ),
    spendingCents: sumCents(spending.map((e) => e.amountCents)),
    byCategory,
  }
}
