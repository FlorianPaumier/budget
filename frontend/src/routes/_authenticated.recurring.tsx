import { prefetchMonth } from '../features/dashboard/loader'
import { createFileRoute } from '@tanstack/react-router'
import { Recurring } from '../features/recurring/screen'
import { validateSearch } from '../lib/search'
export const Route = createFileRoute('/_authenticated/recurring')({
  validateSearch,
  loaderDeps: ({ search }) => ({ month: search.month }),
  loader: prefetchMonth,
  component: Recurring,
})
