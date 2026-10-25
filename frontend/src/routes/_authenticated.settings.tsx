import { prefetchMonth } from '../features/dashboard/loader'
import { createFileRoute } from '@tanstack/react-router'
import { Settings } from '../features/settings/screen'
import { validateSearch } from '../lib/search'
export const Route = createFileRoute('/_authenticated/settings')({
  validateSearch,
  loaderDeps: ({ search }) => ({ month: search.month }),
  loader: prefetchMonth,
  component: Settings,
})
