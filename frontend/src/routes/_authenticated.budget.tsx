import { prefetchMonth } from '../features/dashboard/loader'
import { createFileRoute } from '@tanstack/react-router'
import { Budget } from '../features/budget/screen'
import { validateSearch } from '../lib/search'
export const Route = createFileRoute('/_authenticated/budget')({
  validateSearch,
  loaderDeps: ({ search }) => ({ month: search.month }),
  loader: prefetchMonth,
  component: Budget,
})
