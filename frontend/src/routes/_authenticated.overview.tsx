import { prefetchMonth } from '../features/dashboard/loader'
import { createFileRoute } from '@tanstack/react-router'
import { Dashboard } from '../features/dashboard/screen'
import { validateSearch } from '../lib/search'
export const Route = createFileRoute('/_authenticated/overview')({
  validateSearch,
  loaderDeps: ({ search }) => ({ month: search.month }),
  loader: prefetchMonth,
  component: Dashboard,
})
