import { insightPeriod } from './schemas'
import { validMonth } from './dates'
export type FinancialSearch = {
  period?: 'month' | 'week' | 'quarter' | 'year'
  month?: string
  q?: string
  kind?: string
  category?: string
}
export function validateSearch(
  search: Record<string, unknown>,
): FinancialSearch {
  return {
    period: insightPeriod.catch('month').parse(search.period),
    month:
      typeof search.month === 'string' && validMonth(search.month)
        ? search.month
        : undefined,
    q: typeof search.q === 'string' ? search.q.slice(0, 120) : '',
    kind: typeof search.kind === 'string' ? search.kind : '',
    category: typeof search.category === 'string' ? search.category : '',
  }
}
