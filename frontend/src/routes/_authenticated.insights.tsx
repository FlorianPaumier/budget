import { prefetchMonth } from '../features/dashboard/loader'
import { createFileRoute } from '@tanstack/react-router'
import { Insights } from '../features/insights/screen'
import { validateSearch } from '../lib/search'
export const Route = createFileRoute('/_authenticated/insights')({
  validateSearch,
  loaderDeps: ({ search }) => ({ month: search.month }),
  loader: prefetchMonth,
  component: Insights,
})
