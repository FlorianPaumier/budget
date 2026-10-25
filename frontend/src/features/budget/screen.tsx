import { performMutation, isUncertain } from '../../lib/errors'
import { MutationFeedback } from '../../components/ui/mutation-feedback'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  PageHeading,
  QueryState,
  useMonthData,
  Freshness,
} from '../../components/month-page'
import { formatCad, inputCad, parseCadCents } from '../../lib/money'
import { summarize } from '../insights/selectors'
import { setEstimate, setTarget, getSuggestion } from './functions'
import { unwrap } from '../../lib/errors'
import { categoryStatus } from './status'
import { useDraftGuard } from '../../components/use-draft-guard'
import type { Plan } from '../../lib/schemas'
import type { Category } from '../../lib/schemas'
export function Budget() {
  const query = useMonthData(),
    { data, month } = query
  const [draftCategories, setDraftCategories] = useState<
    Record<string, Category>
  >({})
  const spending = data ? summarize(data.entries, data.through).byCategory : {}
  return (
    <>
      <PageHeading
        eyebrow="DONNER UNE DIRECTION À VOTRE ARGENT"
        title="Budget mensuel"
        description="Un plan pour les dépenses du quotidien et les projets de demain."
      />
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
      />
      {data && (
        <>
          <div className="split-grid">
            <section className="panel">
              <h2>Le mois en perspective</h2>
              {[
                [
                  'Solde disponible au début du mois',
                  data.plan.openingSpendableCents,
                ],
                ['Revenus prévus', data.plan.expectedIncomeCents],
                [
                  'Factures et abonnements prévus',
                  -data.plan.expectedBillsCents,
                ],
                ['Budgets des catégories', -data.plan.estimateCents],
                ['Objectif d’épargne', -data.plan.savingsTargetCents],
              ].map(([label, value]) => (
                <div className="stat-row" key={label}>
                  <span className="muted">{label}</span>
                  <strong>{formatCad(Number(value))}</strong>
                </div>
              ))}
              <div className="stat-row border-t border-[var(--line)] pt-4">
                <strong>Reste prévu</strong>
                <strong>{formatCad(data.plan.moneyLeftCents)}</strong>
              </div>
            </section>
            <section className="panel">
              <h2>Votre objectif d’épargne</h2>
              <p className="muted text-sm mt-3">
                Cet objectif réserve une place dans le plan. Il ne transfère pas
                d’argent.
              </p>
              <TargetEditor
                key={month}
                month={month}
                current={data.plan.savingsTarget}
              />
            </section>
          </div>
          <section className="panel">
            <div className="section-heading">
              <h2>À chaque catégorie, son budget</h2>
              <span className="muted text-xs">
                Dépenses confirmées / budget prévu
              </span>
            </div>
            {[
              ...data.categories,
              ...Object.values(draftCategories).filter(
                (c) => !data.categories.some((current) => current.id === c.id),
              ),
            ]
              .filter(
                (c) =>
                  draftCategories[c.id] ||
                  c.active ||
                  spending[c.id] ||
                  data.plan.estimates.some(
                    (estimate) => estimate.categoryId === c.id,
                  ),
              )
              .map((category) => {
                const estimate = data.plan.estimates.find(
                  (e) => e.categoryId === category.id,
                )
                return (
                  <CategoryBudget
                    key={`${month}-${category.id}`}
                    category={category}
                    onEditing={(open) =>
                      setDraftCategories((current) => {
                        const next = { ...current }
                        if (open) next[category.id] = category
                        else delete next[category.id]
                        return next
                      })
                    }
                    month={month}
                    spent={spending[category.id] || 0}
                    estimate={estimate?.amountCents || 0}
                    revision={estimate?.revision || 0}
                  />
                )
              })}
            {!data.categories.length && (
              <div className="empty-state">
                Créez vos premières catégories dans les paramètres.
              </div>
            )}
          </section>
          <Freshness updatedAt={query.dataUpdatedAt} error={query.error} />
        </>
      )}
    </>
  )
}
function CategoryBudget({
  category,
  onEditing,
  month,
  spent,
  estimate,
  revision,
}: {
  category: Category
  onEditing: (open: boolean) => void
  month: string
  spent: number
  estimate: number
  revision: number
}) {
  const [editing, setEditing] = useState(false),
    [baseRevision, setBaseRevision] = useState(revision),
    [dirty, setDirty] = useState(false),
    [suggestion, setSuggestion] = useState<{
      amountCents: number | null
      sampleCount: number
    } | null>(null),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false)
  const cache = useQueryClient()
  const mutation = useMutation({
    mutationFn: async (amountCents: number) =>
      performMutation(
        async () =>
          await setEstimate({
            data: {
              month,
              categoryId: category.id,
              amountCents,
              revision: baseRevision,
            },
          }),
      ),
    onSuccess: async () => {
      setDirty(false)
      setEditing(false)
      onEditing(false)
      setSuggestion(null)
      await cache.invalidateQueries()
    },
  })
  useDraftGuard(dirty, mutation.isPending)
  async function suggest() {
    if (editing) return
    setBaseRevision(revision)
    setBusy(true)
    setError(null)
    try {
      setSuggestion(
        unwrap(
          await getSuggestion({ data: { month, categoryId: category.id } }),
        ),
      )
    } catch (error) {
      setError(error)
    } finally {
      setBusy(false)
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    try {
      const amount = parseCadCents(
        String(new FormData(event.currentTarget).get('amount')),
      )
      if (amount < 0) throw new Error('Le budget ne peut pas être négatif.')
      mutation.mutate(amount)
    } catch (error) {
      setError(error)
    }
  }
  return (
    <article className="budget-row">
      <header>
        <strong>{category.name}</strong>
        <span className="tabular-nums">
          {formatCad(spent)}{' '}
          <span className="muted">/ {formatCad(estimate)}</span>
        </span>
      </header>
      <div
        className="progress"
        role="meter"
        aria-label={`Budget ${category.name}`}
        aria-valuemin={0}
        aria-valuemax={Math.max(estimate, spent, 1)}
        aria-valuenow={spent}
        aria-valuetext={`${formatCad(spent)} dépensés sur ${formatCad(estimate)}`}
      >
        <span
          style={{
            width: `${estimate ? Math.min(100, (spent / estimate) * 100) : spent ? 100 : 0}%`,
          }}
        />
      </div>
      <p>
        {categoryStatus(spent, estimate)} ·{' '}
        {spent > estimate
          ? `${formatCad(spent - estimate)} de dépassement`
          : `${formatCad(estimate - spent)} restants`}
      </p>
      <div className="actions">
        <button
          disabled={mutation.isPending || busy}
          onClick={() => {
            if (!editing) {
              setBaseRevision(revision)
              setSuggestion(null)
              mutation.reset()
            } else if (dirty && !window.confirm('Abandonner ce brouillon ?'))
              return
            setDirty(false)
            setEditing(!editing)
            onEditing(!editing)
          }}
        >
          {editing ? 'Annuler' : 'Modifier le budget'}
        </button>
        <button
          disabled={
            editing || busy || mutation.isPending || isUncertain(mutation.error)
          }
          onClick={() => void suggest()}
        >
          Suggestion médiane
        </button>
      </div>
      {editing && (
        <form onSubmit={submit} onChange={() => setDirty(true)}>
          <fieldset disabled={mutation.isPending} className="contents">
            <label>
              Budget pour {category.name} (CAD)
              <input
                name="amount"
                inputMode="decimal"
                defaultValue={inputCad(estimate)}
                required
              />
            </label>
            <button
              className="primary self-start"
              disabled={mutation.isPending || isUncertain(mutation.error)}
            >
              Enregistrer le budget
            </button>
          </fieldset>
        </form>
      )}
      {suggestion && (
        <div className="notice">
          {suggestion.amountCents === null ? (
            'Pas encore assez de données pour une suggestion.'
          ) : (
            <>
              <p>
                Médiane : {formatCad(suggestion.amountCents)} sur{' '}
                {suggestion.sampleCount} mois avec dépenses.
              </p>
              <button
                disabled={
                  editing || mutation.isPending || isUncertain(mutation.error)
                }
                onClick={() => mutation.mutate(suggestion.amountCents!)}
              >
                Accepter cette suggestion
              </button>
            </>
          )}
        </div>
      )}
      <MutationFeedback mutation={mutation} error={error} />
    </article>
  )
}

function TargetEditor({
  month,
  current,
}: {
  month: string
  current: Plan['savingsTarget']
}) {
  const [base, setBase] = useState(current),
    [value, setValue] = useState(
      current?.amountCents == null ? '' : inputCad(current.amountCents),
    ),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState<unknown>(null)
  const cache = useQueryClient()
  const mutation = useMutation({
    mutationFn: async (amountCents: number | null) =>
      performMutation(
        async () =>
          await setTarget({
            data: { month, amountCents, revision: base?.revision || 0 },
          }),
      ),
    onSuccess: async (accepted) => {
      setBase(accepted)
      setDirty(false)
      await cache.invalidateQueries()
    },
  })
  useDraftGuard(dirty, mutation.isPending)
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    try {
      const amount = value.trim() === '' ? null : parseCadCents(value)
      if (amount !== null && amount < 0)
        throw new Error('L’objectif ne peut pas être négatif.')
      mutation.mutate(amount)
    } catch (error) {
      setError(error)
    }
  }
  return (
    <form onSubmit={save}>
      <fieldset disabled={mutation.isPending} className="contents">
        <label>
          Montant prévu (CAD)
          <input
            name="target"
            inputMode="decimal"
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setDirty(true)
            }}
            placeholder="Aucun objectif"
          />
          <small className="muted">
            Laissez vide pour retirer l’objectif. Zéro reste un objectif
            explicite.
          </small>
        </label>
        {current?.revision !== base?.revision && (
          <div className="notice">
            <p>L’objectif du serveur a changé. Votre brouillon est conservé.</p>
            <button
              type="button"
              onClick={() => {
                if (
                  dirty &&
                  !window.confirm(
                    'Remplacer votre brouillon par la version du serveur ?',
                  )
                )
                  return
                setBase(current)
                setValue(
                  current?.amountCents == null
                    ? ''
                    : inputCad(current.amountCents),
                )
                setDirty(false)
                mutation.reset()
              }}
            >
              Charger l’objectif actuel
            </button>
          </div>
        )}
        <MutationFeedback mutation={mutation} error={error} />
        <button
          className="primary self-start"
          disabled={mutation.isPending || isUncertain(mutation.error)}
        >
          Enregistrer l’objectif
        </button>
      </fieldset>
    </form>
  )
}
