import type { QueryClient } from '@tanstack/react-query'
import { householdQuery, monthQuery } from './queries'
import { householdToday } from '../../lib/dates'
export async function prefetchMonth({
  context,
  deps,
}: {
  context: { queryClient: QueryClient; access: { householdId: string } }
  deps: { month?: string }
}) {
  const household = await context.queryClient.ensureQueryData(
    householdQuery(context.access.householdId),
  )
  const month =
    deps.month || householdToday(new Date(), household.timeZone).slice(0, 7)
  await context.queryClient.ensureQueryData(
    monthQuery(context.access.householdId, month),
  )
}
