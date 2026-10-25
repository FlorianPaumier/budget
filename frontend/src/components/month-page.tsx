import { useQuery } from '@tanstack/react-query'
import { useSearch } from '@tanstack/react-router'
import { Route } from '../routes/_authenticated'
import { householdQuery, monthQuery } from '../features/dashboard/queries'
import { householdToday } from '../lib/dates'
import { errorMessage } from '../lib/errors'
import type { ReactNode } from 'react'
export function useMonthData() {
  const { access } = Route.useRouteContext()
  const { data: household } = useQuery(householdQuery(access.householdId))
  const search = useSearch({ strict: false }) as { month?: string }
  const month =
    search.month ||
    householdToday(new Date(), household?.timeZone || 'America/Toronto').slice(
      0,
      7,
    )
  return { ...useQuery(monthQuery(access.householdId, month)), month, access }
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {action}
    </div>
  )
}
export function QueryState({
  pending,
  error,
  retry,
}: {
  pending: boolean
  error: unknown
  retry: () => unknown
}) {
  if (pending)
    return (
      <div role="status" className="empty-state">
        Chargement de votre budget…
      </div>
    )
  if (error)
    return (
      <div role="alert" className="error">
        <p>{errorMessage(error)}</p>
        <button onClick={() => void retry()}>Réessayer</button>
      </div>
    )
  return null
}
export function Freshness({
  updatedAt,
  error,
}: {
  updatedAt: number
  error: unknown
}) {
  return (
    <p className={`freshness ${error ? 'error' : ''}`}>
      {error ? 'Données anciennes · actualisation échouée. ' : ''}Dernière
      lecture :{' '}
      {new Intl.DateTimeFormat('fr-CA', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(updatedAt)}
    </p>
  )
}
