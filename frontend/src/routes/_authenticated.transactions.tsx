import { prefetchMonth } from '../features/dashboard/loader'
import { createFileRoute } from '@tanstack/react-router'
import { Transactions } from '../features/transactions/screen'
import { validateSearch } from '../lib/search'
export const Route = createFileRoute('/_authenticated/transactions')({
  validateSearch,
  loaderDeps: ({ search }) => ({ month: search.month }),
  loader: prefetchMonth,
  component: Transactions,
})
