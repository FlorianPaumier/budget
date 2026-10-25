import { performMutation, isUncertain } from '../../lib/errors'
import { MutationFeedback } from '../../components/ui/mutation-feedback'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import {
  useMonthData,
  PageHeading,
  QueryState,
} from '../../components/month-page'
import { useDraftGuard } from '../../components/use-draft-guard'
import {
  getRecurring,
  createRule,
  updateRule,
  deleteRule,
  confirmOccurrence,
} from './functions'
import { ruleInputSchema } from '../../lib/schemas'
import type { Rule, Category, Occurrence } from '../../lib/schemas'
import { unwrap } from '../../lib/errors'
import { formatCad, inputCad, parseCadCents } from '../../lib/money'
import { formatDate, monthEnd, shiftMonth } from '../../lib/dates'
const frequencyLabels: Record<string, string> = {
  daily: 'Chaque jour',
  weekly: 'Chaque semaine',
  biweekly: 'Toutes les deux semaines',
  twice_monthly: 'Deux fois par mois',
  monthly: 'Chaque mois',
  yearly: 'Chaque année',
}
export function Recurring() {
  const monthly = useMonthData(),
    { data, month, access } = monthly,
    cache = useQueryClient()
  const range = { from: `${month}-01`, through: monthEnd(month) }
  const recurring = useQuery({
    queryKey: [access.householdId, 'recurring', month],
    queryFn: async () => unwrap(await getRecurring({ data: range })),
  })
  const [editing, setEditing] = useState<Rule | null | undefined>(undefined)
  const [occurrenceDraft, setOccurrenceDraft] = useState<Occurrence | null>(
    null,
  )
  const editorOpen = editing !== undefined || occurrenceDraft !== null
  const removal = useMutation({
    mutationFn: async (rule: Rule) =>
      performMutation(
        async () =>
          await deleteRule({
            data: { id: rule.id, revision: rule.revision, range },
          }),
      ),
    onSuccess: () => cache.invalidateQueries(),
  })
  return (
    <>
      <PageHeading
        eyebrow="ANTICIPER SANS Y PENSER"
        title="Opérations régulières"
        description="Vos revenus, factures et abonnements, dans le bon rythme."
        action={
          <button
            className="primary"
            disabled={editorOpen}
            onClick={() => setEditing(null)}
          >
            <Plus size={18} />
            Ajouter une opération
          </button>
        }
      />
      <QueryState
        pending={monthly.isPending || recurring.isPending}
        error={monthly.error || recurring.error}
        retry={() => {
          void monthly.refetch()
          void recurring.refetch()
        }}
      />
      {data && recurring.data && (
        <>
          {editing !== undefined && (
            <RuleEditor
              key={`${editing?.id || 'new'}-${month}`}
              rule={editing}
              categories={data.categories}
              defaultDate={data.today}
              through={monthEnd(shiftMonth(data.today.slice(0, 7), 2))}
              onClose={() => setEditing(undefined)}
            />
          )}
          {occurrenceDraft && (
            <OccurrenceEditor
              occurrence={occurrenceDraft}
              onClose={() => setOccurrenceDraft(null)}
            />
          )}
          <section className="panel">
            <div className="section-heading">
              <h2>À suivre ce mois-ci</h2>
              <span className="muted text-xs">
                Les montants attendus ne sont pas encore des dépenses
                confirmées.
              </span>
            </div>
            {recurring.data.occurrences.length ? (
              recurring.data.occurrences.map((occurrence) => (
                <OccurrenceRow
                  key={occurrence.id}
                  occurrence={occurrence}
                  disabled={editorOpen}
                  onEdit={() => setOccurrenceDraft(occurrence)}
                />
              ))
            ) : (
              <div className="empty-state">Aucune échéance pour ce mois.</div>
            )}
          </section>
          <section className="panel">
            <div className="section-heading">
              <h2>Vos opérations</h2>
            </div>
            <MutationFeedback mutation={removal} />
            {recurring.data.rules.map((rule) => (
              <div className="transaction-row" key={rule.id}>
                <div className="grow">
                  <strong>{rule.name}</strong>
                  <p className="muted">
                    {frequencyLabels[rule.frequency]} · intervalle{' '}
                    {rule.interval}
                    {!rule.active ? ' · Inactive' : ''}
                  </p>
                </div>
                <strong>{formatCad(rule.amountCents)}</strong>
                <div className="actions">
                  <button
                    disabled={editorOpen}
                    onClick={() => setEditing(rule)}
                  >
                    Modifier
                  </button>
                  <button
                    className="danger"
                    disabled={
                      editorOpen ||
                      removal.isPending ||
                      isUncertain(removal.error)
                    }
                    onClick={() => {
                      if (
                        window.confirm(
                          'Supprimer cette opération régulière ? Les confirmations passées sont conservées.',
                        )
                      )
                        removal.mutate(rule)
                    }}
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
            {!recurring.data.rules.length && (
              <div className="empty-state">
                Commencez par votre loyer, un abonnement ou votre salaire.
              </div>
            )}
          </section>
        </>
      )}
    </>
  )
}
function RuleEditor({
  rule,
  categories,
  defaultDate,
  through,
  onClose,
}: {
  rule: Rule | null
  categories: Category[]
  defaultDate: string
  through: string
  onClose: () => void
}) {
  const [frequency, setFrequency] = useState(rule?.frequency || 'monthly'),
    [error, setError] = useState<unknown>(null),
    [dirty, setDirty] = useState(false)
  const cache = useQueryClient()
  const mutation = useMutation({
    mutationFn: async ({
      input,
      from,
      through,
    }: {
      input: ReturnType<typeof ruleInputSchema.parse>
      from: string
      through: string
    }) =>
      performMutation(async () =>
        rule
          ? await updateRule({
              data: {
                id: rule.id,
                revision: rule.revision,
                input,
                range: { from, through },
              },
            })
          : await createRule({ data: input }),
      ),
    onSuccess: async () => {
      setDirty(false)
      await cache.invalidateQueries()
      onClose()
    },
  })
  useDraftGuard(dirty, mutation.isPending)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const f = new FormData(event.currentTarget)
    try {
      const parsed = ruleInputSchema.safeParse({
        kind: f.get('kind'),
        name: f.get('name'),
        amountCents: parseCadCents(String(f.get('amount'))),
        categoryId: String(f.get('category')) || null,
        frequency,
        interval: Number(f.get('interval')),
        startsOn: f.get('startsOn'),
        endsOn: String(f.get('endsOn')) || null,
        scheduleDetails:
          frequency === 'twice_monthly'
            ? { days: [Number(f.get('day1')), Number(f.get('day2'))] }
            : null,
      })
      if (!parsed.success) throw new Error(parsed.error.issues[0].message)
      mutation.mutate({
        input: parsed.data,
        from: String(f.get('from') || defaultDate),
        through: String(f.get('through') || through),
      })
    } catch (error) {
      setError(error)
    }
  }
  function close() {
    if (!dirty || window.confirm('Abandonner les modifications ?')) onClose()
  }
  return (
    <section className="editor">
      <h2>{rule ? 'Modifier l’opération' : 'Nouvelle opération régulière'}</h2>
      <form onSubmit={submit} onChange={() => setDirty(true)}>
        <fieldset className="contents" disabled={mutation.isPending}>
          <div className="form-grid">
            <label>
              Nom
              <input
                name="name"
                defaultValue={rule?.name || ''}
                required
                maxLength={160}
              />
            </label>
            <label>
              Type
              <select name="kind" defaultValue={rule?.kind || 'bill'}>
                <option value="bill">Facture</option>
                <option value="subscription">Abonnement</option>
                <option value="income">Revenu</option>
              </select>
            </label>
            <label>
              Montant (CAD)
              <input
                name="amount"
                inputMode="decimal"
                defaultValue={rule ? inputCad(rule.amountCents) : ''}
                required
              />
            </label>
            <label>
              Catégorie
              <select name="category" defaultValue={rule?.categoryId || ''}>
                <option value="">Sans catégorie</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Fréquence
              <select
                value={frequency}
                onChange={(e) =>
                  setFrequency(e.target.value as Rule['frequency'])
                }
              >
                {Object.entries(frequencyLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Intervalle
              <input
                type="number"
                name="interval"
                defaultValue={rule?.interval || 1}
                min={1}
                max={1000}
                required
              />
            </label>
            <label>
              Début
              <input
                type="date"
                name="startsOn"
                defaultValue={rule?.startsOn || defaultDate}
                required
              />
            </label>
            <label>
              Fin (facultatif)
              <input
                type="date"
                name="endsOn"
                defaultValue={rule?.endsOn || ''}
              />
            </label>
            {frequency === 'twice_monthly' && (
              <>
                <label>
                  Premier jour du mois
                  <input
                    name="day1"
                    type="number"
                    min={1}
                    max={31}
                    defaultValue={rule?.scheduleDetails?.days[0] || 1}
                    required
                  />
                </label>
                <label>
                  Deuxième jour du mois
                  <input
                    name="day2"
                    type="number"
                    min={1}
                    max={31}
                    defaultValue={rule?.scheduleDetails?.days[1] || 15}
                    required
                  />
                </label>
              </>
            )}
            {rule && (
              <>
                <label>
                  Régénérer à partir du
                  <input
                    type="date"
                    name="from"
                    defaultValue={defaultDate}
                    required
                  />
                </label>
                <label>
                  Jusqu’au
                  <input
                    type="date"
                    name="through"
                    defaultValue={through}
                    required
                  />
                </label>
              </>
            )}
          </div>
          <MutationFeedback mutation={mutation} error={error} />
          <div className="actions">
            <button
              className="primary"
              disabled={mutation.isPending || isUncertain(mutation.error)}
            >
              Enregistrer l’opération
            </button>
            <button type="button" disabled={mutation.isPending} onClick={close}>
              Annuler
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  )
}
function OccurrenceRow({
  occurrence,
  disabled,
  onEdit,
}: {
  occurrence: Occurrence
  disabled: boolean
  onEdit: () => void
}) {
  return (
    <article className="budget-row">
      <header>
        <div>
          <strong>{occurrence.ruleName}</strong>
          <p>
            {formatDate(occurrence.expectedDate)} ·{' '}
            {occurrence.status === 'confirmed' ? 'Confirmée' : 'Attendue'}
            {occurrence.needsReview ? ' · À vérifier' : ''}
          </p>
        </div>
        <strong>
          {formatCad(
            occurrence.actualAmountCents ?? occurrence.expectedAmountCents,
          )}
        </strong>
      </header>
      <div className="actions">
        <button disabled={disabled} onClick={onEdit}>
          {occurrence.status === 'confirmed'
            ? 'Corriger la confirmation'
            : 'Confirmer'}
        </button>
      </div>
    </article>
  )
}
function OccurrenceEditor({
  occurrence,
  onClose,
}: {
  occurrence: Occurrence
  onClose: () => void
}) {
  const [dirty, setDirty] = useState(false),
    [error, setError] = useState<unknown>(null),
    cache = useQueryClient()
  const mutation = useMutation({
    mutationFn: (input: { actualDate: string; actualAmountCents: number }) =>
      performMutation(() =>
        confirmOccurrence({
          data: { id: occurrence.id, revision: occurrence.revision, ...input },
        }),
      ),
    onSuccess: async () => {
      setDirty(false)
      await cache.invalidateQueries()
      onClose()
    },
  })
  useDraftGuard(dirty, mutation.isPending)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    try {
      const f = new FormData(event.currentTarget),
        amount = parseCadCents(String(f.get('amount')))
      if (amount <= 0) throw new Error('Le montant doit être positif.')
      mutation.mutate({
        actualDate: String(f.get('date')),
        actualAmountCents: amount,
      })
    } catch (error) {
      setError(error)
    }
  }
  return (
    <section className="editor" aria-label="Confirmation">
      <h2>Confirmation · {occurrence.ruleName}</h2>
      <p className="muted">
        Votre brouillon garde la version ouverte, même si une échéance est
        modifiée ou régénérée. Copiez-le avant de fermer pour charger la version
        actuelle.
      </p>
      <form onSubmit={submit} onChange={() => setDirty(true)}>
        <fieldset className="contents" disabled={mutation.isPending}>
          <div className="form-grid">
            <label>
              Date réelle
              <input
                type="date"
                name="date"
                defaultValue={occurrence.actualDate || occurrence.expectedDate}
                required
              />
            </label>
            <label>
              Montant réel (CAD)
              <input
                name="amount"
                inputMode="decimal"
                defaultValue={inputCad(
                  occurrence.actualAmountCents ??
                    occurrence.expectedAmountCents,
                )}
                required
              />
            </label>
          </div>
          <MutationFeedback mutation={mutation} error={error} />
          <div className="actions">
            <button
              className="primary"
              disabled={mutation.isPending || isUncertain(mutation.error)}
            >
              Enregistrer la confirmation
            </button>
            <button
              type="button"
              onClick={() => {
                if (!dirty || window.confirm('Abandonner ce brouillon ?'))
                  onClose()
              }}
            >
              Annuler
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  )
}
