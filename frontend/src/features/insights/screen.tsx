import { useNavigate, useSearch } from '@tanstack/react-router'
import { getInsightEntries } from './functions'
import { unwrap } from '../../lib/errors'
import { insightPeriod } from '../../lib/schemas'
import { useQuery } from '@tanstack/react-query'
import {
  PageHeading,
  QueryState,
  useMonthData,
} from '../../components/month-page'
import { monthQuery } from '../dashboard/queries'
import { summarize } from './selectors'
import { formatCad } from '../../lib/money'
import { activityThrough, shiftMonth, formatMonth } from '../../lib/dates'
export function Insights() {
  const current = useMonthData(),
    { data, month, access } = current
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { period?: string }
  const period = insightPeriod.catch('month').parse(search.period)
  const priorMonth = shiftMonth(month, -1)
  const prior = useQuery({
    ...monthQuery(access.householdId, priorMonth),
    enabled: period === 'month',
  })
  const range = useQuery({
    queryKey: [access.householdId, 'insights', month, period, data?.today],
    enabled: !!data && period !== 'month',
    queryFn: async () =>
      unwrap(await getInsightEntries({ data: { month, period } })),
  })
  const summary =
    period === 'month'
      ? data
        ? summarize(data.entries, data.through)
        : null
      : range.data
        ? summarize(range.data.entries, range.data.through)
        : null
  const previous = prior.data
    ? summarize(
        prior.data.entries,
        activityThrough(priorMonth, prior.data.today),
      )
    : null
  return (
    <>
      <PageHeading
        eyebrow="PRENDRE UN PEU DE RECUL"
        title="Analyses"
        description="Comprendre vos habitudes, à partir des mouvements confirmés."
      />
      <label className="max-w-xs mb-6">
        Période analysée
        <select
          value={period}
          onChange={(event) =>
            void navigate({
              to: '.',
              search: (old: Record<string, unknown>) => ({
                ...old,
                period: insightPeriod.parse(event.target.value),
              }),
            })
          }
        >
          <option value="month">Mois sélectionné</option>
          <option value="week">7 derniers jours de la période</option>
          <option value="quarter">3 mois calendaires</option>
          <option value="year">12 mois calendaires</option>
        </select>
      </label>
      {period !== 'month' && (
        <QueryState
          pending={range.isPending}
          error={range.error}
          retry={range.refetch}
        />
      )}
      <QueryState
        pending={current.isPending}
        error={current.error}
        retry={current.refetch}
      />
      {data && summary && (
        <>
          <div className="split-grid">
            <section className="panel">
              <h2>Revenus et dépenses</h2>
              <p className="muted text-sm mt-3">
                {period === 'month'
                  ? formatMonth(month)
                  : `${range.data?.from || ''} → ${range.data?.through || ''}`}{' '}
                · activité confirmée, sans projection.
              </p>
              <div className="stat-row">
                <span>Revenus</span>
                <strong>{formatCad(summary.incomeCents)}</strong>
              </div>
              <div className="stat-row">
                <span>Dépenses</span>
                <strong>{formatCad(summary.spendingCents)}</strong>
              </div>
              <p className="muted text-xs leading-6">
                Les transferts d’épargne et ajustements de solde sont exclus.
                Les ajustements de catégorie font partie des dépenses.
              </p>
            </section>
            <section className="panel">
              <h2>
                {period === 'month' ? 'Le mois précédent' : 'Votre période'}
              </h2>
              {period !== 'month' && (
                <p className="muted text-sm mt-3">
                  {range.data?.months.length || 0} mois chargés explicitement
                  depuis le serveur. Les dates futures sont exclues.
                </p>
              )}
              {period === 'month' && (
                <QueryState
                  pending={prior.isPending}
                  error={prior.error}
                  retry={prior.refetch}
                />
              )}
              {period === 'month' && previous && (
                <>
                  <p className="muted text-sm mt-3">
                    {formatMonth(priorMonth)} · période chargée séparément.
                  </p>
                  <div className="stat-row">
                    <span>Revenus</span>
                    <strong>{formatCad(previous.incomeCents)}</strong>
                  </div>
                  <div className="stat-row">
                    <span>Dépenses</span>
                    <strong>{formatCad(previous.spendingCents)}</strong>
                  </div>
                  <p className="muted text-xs">
                    Un mois en cours et un mois terminé ne couvrent pas la même
                    durée.
                  </p>
                </>
              )}
            </section>
          </div>
          <section className="panel">
            <div className="section-heading">
              <h2>Où va votre argent ?</h2>
              <span className="badge">{formatCad(summary.spendingCents)}</span>
            </div>
            {Object.entries(summary.byCategory).length ? (
              <table>
                <caption className="sr-only">
                  Répartition des dépenses par catégorie
                </caption>
                <thead>
                  <tr>
                    <th>Catégorie</th>
                    <th>Répartition</th>
                    <th>Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(summary.byCategory)
                    .sort((a, b) => b[1] - a[1])
                    .map(([id, value]) => (
                      <tr key={id}>
                        <th scope="row">
                          {data.categories.find((c) => c.id === id)?.name ||
                            'Sans catégorie'}
                        </th>
                        <td>
                          <div
                            className="chart-bar"
                            style={{
                              width: `${summary.spendingCents ? (value / summary.spendingCents) * 100 : 0}%`,
                            }}
                            aria-hidden="true"
                          />
                          <span className="muted text-xs">
                            {Math.round(
                              summary.spendingCents
                                ? (value / summary.spendingCents) * 100
                                : 0,
                            )}{' '}
                            %
                          </span>
                        </td>
                        <td className="tabular-nums">{formatCad(value)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                Aucune dépense confirmée dans cette période.
              </div>
            )}
          </section>
        </>
      )}
    </>
  )
}
