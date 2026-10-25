import { createFileRoute, redirect, Outlet } from '@tanstack/react-router'
import { inspectSession } from '../features/access/functions'
import { householdQuery } from '../features/dashboard/queries'
import { AppShell } from '../components/app-shell'
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    const access = await inspectSession()
    if (!access) throw redirect({ to: '/pair' })
    return { access }
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      householdQuery(context.access.householdId),
    )
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
})
