import { performMutation, isUncertain } from '../../lib/errors'
import { MutationFeedback } from '../../components/ui/mutation-feedback'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Plus, ArrowUpRight, ArrowDownLeft, X } from 'lucide-react'
import {
  useMonthData,
  PageHeading,
  QueryState,
  Freshness,
} from '../../components/month-page'
import { useDraftGuard } from '../../components/use-draft-guard'
import {
  createEntry,
  updateEntry,
  deleteEntry,
  getHistory,
  getEntry,
} from './functions'
import { unwrap, RequestFailure } from '../../lib/errors'
import { formatCad, inputCad, parseCadCents } from '../../lib/money'
import { formatDate } from '../../lib/dates'
import { entryInputSchema } from '../../lib/schemas'
import type { Entry, Category } from '../../lib/schemas'
const labels: Record<string, string> = {
  income: 'Revenu',
  expense: 'Dépense',
  category_adjustment: 'Ajustement de catégorie',
  savings_transfer: 'Transfert d’épargne',
  balance_adjustment: 'Ajustement de solde',
}
export function Transactions() {
  const query = useMonthData(),
    { data, month } = query,
    navigate = useNavigate(),
    cache = useQueryClient()
  const search = useSearch({ strict: false }) as {
    q?: string
    kind?: string
    category?: string
  }
  const [editing, setEditing] = useState<Entry | null | undefined>(undefined),
    [historyId, setHistoryId] = useState<string | null>(null)
  const removal = useMutation({
    mutationFn: async (entry: Entry) =>
      performMutation(
        async () =>
          await deleteEntry({
            data: { id: entry.id, revision: entry.revision },
          }),
      ),
    onSuccess: () =>
      cache.invalidateQueries({ queryKey: [query.access.householdId] }),
  })
  const entries =
    data?.entries.filter(
      (entry) =>
        (!search.q ||
          (entry.note || '')
            .toLocaleLowerCase('fr-CA')
            .includes(search.q.toLocaleLowerCase('fr-CA'))) &&
        (!search.kind || entry.kind === search.kind) &&
        (!search.category || entry.categoryId === search.category),
    ) || []
  function filter(key: string, value: string) {
    void navigate({
      to: '.',
      search: (old: Record<string, unknown>) => ({ ...old, [key]: value }),
    })
  }
  return (
    <>
      <PageHeading
        eyebrow="CHAQUE MOUVEMENT COMPTE"
        title="Transactions"
        description="Les revenus et les dépenses de votre quotidien."
        action={
          <button
            className="primary"
            disabled={editing !== undefined}
            onClick={() => setEditing(null)}
          >
            <Plus size={18} />
            Ajouter une transaction
          </button>
        }
      />
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
      />
      {data && (
        <>
          {editing !== undefined && (
            <EntryEditor
              key={editing?.id || 'new'}
              entry={editing}
              categories={data.categories}
              defaultDate={
                data.today.startsWith(month) ? data.today : `${month}-01`
              }
              onClose={() => setEditing(undefined)}
            />
          )}
          <section className="panel">
            <div className="section-heading">
              <h2>Les mouvements du mois</h2>
              <span className="badge">
                {entries.length} transaction{entries.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="filters">
              <label>
                Rechercher
                <input
                  type="search"
                  value={search.q || ''}
                  onChange={(e) => filter('q', e.target.value)}
                  placeholder="Rechercher une note…"
                />
              </label>
              <label>
                Type
                <select
                  value={search.kind || ''}
                  onChange={(e) => filter('kind', e.target.value)}
                >
                  <option value="">Tous les types</option>
                  {Object.entries(labels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Catégorie
                <select
                  value={search.category || ''}
                  onChange={(e) => filter('category', e.target.value)}
                >
                  <option value="">Toutes les catégories</option>
                  {data.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <MutationFeedback mutation={removal} />
            {entries.length ? (
              <div className="table-wrap">
                <table>
                  <caption className="sr-only">
                    Transactions du mois sélectionné
                  </caption>
                  <thead>
                    <tr>
                      <th>Date et description</th>
                      <th>Catégorie</th>
                      <th>Type</th>
                      <th>Montant et actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={entry.id}>
                        <td>
                          <div className="actions">
                            <span
                              className={`flow-icon ${entry.kind === 'income' ? 'income' : 'expense'}`}
                            >
                              {entry.kind === 'income' ? (
                                <ArrowDownLeft size={17} />
                              ) : (
                                <ArrowUpRight size={17} />
                              )}
                            </span>
                            <div>
                              <strong>
                                {entry.note || labels[entry.kind]}
                              </strong>
                              <p className="muted text-xs">
                                {formatDate(entry.entryDate)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td>
                          {data.categories.find(
                            (c) => c.id === entry.categoryId,
                          )?.name || '—'}
                        </td>
                        <td>
                          <span className="badge">{labels[entry.kind]}</span>
                          {entry.occurrenceId && (
                            <p className="muted text-xs">Opération régulière</p>
                          )}
                        </td>
                        <td>
                          <strong className="tabular-nums">
                            {formatCad(entry.amountCents)}
                          </strong>
                          <div className="actions justify-end mt-2">
                            <button onClick={() => setHistoryId(entry.id)}>
                              Historique
                            </button>
                            {!entry.occurrenceId && (
                              <>
                                <button
                                  disabled={editing !== undefined}
                                  onClick={() => setEditing(entry)}
                                >
                                  Modifier
                                </button>
                                <button
                                  className="danger"
                                  disabled={
                                    editing !== undefined ||
                                    removal.isPending ||
                                    isUncertain(removal.error)
                                  }
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        'Supprimer cette transaction ?',
                                      )
                                    )
                                      removal.mutate(entry)
                                  }}
                                >
                                  Supprimer
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <h3>Aucune transaction à afficher</h3>
                <p>Ajoutez un mouvement ou modifiez vos filtres.</p>
                <button
                  onClick={() => void navigate({ to: '.', search: { month } })}
                >
                  Réinitialiser les filtres
                </button>
              </div>
            )}
          </section>
          {historyId && (
            <History
              householdId={query.access.householdId}
              id={historyId}
              onClose={() => setHistoryId(null)}
            />
          )}
          <Freshness updatedAt={query.dataUpdatedAt} error={query.error} />
        </>
      )}
    </>
  )
}
function EntryEditor({
  entry,
  categories,
  defaultDate,
  onClose,
}: {
  entry: Entry | null
  categories: Category[]
  defaultDate: string
  onClose: () => void
}) {
  const cache = useQueryClient(),
    [kind, setKind] = useState(entry?.kind || 'expense'),
    [dirty, setDirty] = useState(false),
    [localError, setLocalError] = useState<unknown>(null),
    [latest, setLatest] = useState<Entry | null>(null)
  const mutation = useMutation({
    mutationFn: async (input: ReturnType<typeof entryInputSchema.parse>) =>
      performMutation(async () =>
        entry
          ? await updateEntry({
              data: { id: entry.id, revision: entry.revision, input },
            })
          : await createEntry({ data: input }),
      ),
    onSuccess: async () => {
      setDirty(false)
      await cache.invalidateQueries()
      onClose()
    },
    onError: () => {
      void cache.invalidateQueries()
    },
  })
  useDraftGuard(dirty, mutation.isPending)
  const uncertain =
    mutation.error instanceof RequestFailure &&
    mutation.error.failure.outcomeUncertain
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (uncertain) return
    setLocalError(null)
    const form = new FormData(event.currentTarget)
    try {
      const parsed = entryInputSchema.safeParse({
        kind,
        entryDate: String(form.get('date')),
        amountCents: parseCadCents(String(form.get('amount'))),
        categoryId:
          kind === 'savings_transfer'
            ? null
            : String(form.get('category')) || null,
        account:
          kind === 'balance_adjustment'
            ? String(form.get('account'))
            : undefined,
        note: String(form.get('note')) || null,
      })
      if (!parsed.success) throw new Error(parsed.error.issues[0].message)
      mutation.mutate(parsed.data)
    } catch (error) {
      setLocalError(error)
    }
  }
  function close() {
    if (!dirty || window.confirm('Abandonner ce brouillon ?')) onClose()
  }
  return (
    <section
      className="editor"
      aria-label={entry ? 'Modifier la transaction' : 'Nouvelle transaction'}
    >
      <div className="section-heading">
        <h2>{entry ? 'Modifier la transaction' : 'Nouvelle transaction'}</h2>
        <button
          className="icon-button"
          aria-label="Fermer le formulaire"
          disabled={mutation.isPending}
          onClick={close}
        >
          <X size={18} />
        </button>
      </div>
      <form onSubmit={submit} onChange={() => setDirty(true)}>
        <fieldset disabled={mutation.isPending} className="contents">
          <div className="form-grid">
            <label>
              Type
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as Entry['kind'])}
              >
                {Object.entries(labels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Date
              <input
                name="date"
                type="date"
                defaultValue={entry?.entryDate || defaultDate}
                required
              />
            </label>
            <label>
              Montant (CAD)
              <input
                name="amount"
                inputMode="decimal"
                defaultValue={entry ? inputCad(entry.amountCents) : ''}
                placeholder="0,00"
                required
                aria-describedby="amount-help"
              />
              <small id="amount-help" className="muted">
                {['savings_transfer', 'balance_adjustment'].includes(kind)
                  ? 'Un montant négatif inverse le mouvement.'
                  : 'Montant positif, au plus deux décimales.'}
              </small>
            </label>
            {kind !== 'savings_transfer' && (
              <label>
                Catégorie
                <select name="category" defaultValue={entry?.categoryId || ''}>
                  <option value="">Sans catégorie</option>
                  {categories
                    .filter((c) => c.active || c.id === entry?.categoryId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            {kind === 'balance_adjustment' && (
              <label>
                Compte
                <select
                  name="account"
                  defaultValue={entry?.account || 'spendable'}
                >
                  <option value="spendable">Disponible</option>
                  <option value="savings">Épargne</option>
                </select>
              </label>
            )}
          </div>
          <label>
            Note
            <textarea
              name="note"
              defaultValue={entry?.note || ''}
              maxLength={500}
            />
          </label>
          <MutationFeedback mutation={mutation} error={localError} />
          {mutation.error instanceof RequestFailure &&
            [409, 404].includes(mutation.error.failure.status) &&
            entry && (
              <div className="notice">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      setLatest(unwrap(await getEntry({ data: entry.id })))
                    } catch (error) {
                      setLocalError(error)
                    }
                  }}
                >
                  Consulter la version actuelle
                </button>
                {latest && (
                  <p>
                    Serveur : {formatCad(latest.amountCents)} ·{' '}
                    {latest.entryDate} · {latest.note || 'Sans note'}. Copiez
                    votre brouillon avant de fermer puis rouvrir la transaction
                    pour utiliser cette version.
                  </p>
                )}
              </div>
            )}
          <div className="actions">
            <button
              className="primary"
              disabled={
                mutation.isPending || isUncertain(mutation.error) || uncertain
              }
            >
              {mutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
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
function History({
  householdId,
  id,
  onClose,
}: {
  householdId: string
  id: string
  onClose: () => void
}) {
  const query = useQuery({
    queryKey: [householdId, 'history', id],
    queryFn: async () => unwrap(await getHistory({ data: id })),
  })
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Historique de la transaction</h2>
        <button onClick={onClose}>Fermer</button>
      </div>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
      />
      {query.data?.map((event) => (
        <div className="history-item" key={event.id}>
          <strong>{event.deviceLabel || 'Appareil du ménage'}</strong>
          <p>
            {new Intl.DateTimeFormat('fr-CA', {
              dateStyle: 'medium',
              timeStyle: 'short',
            }).format(new Date(event.createdAt))}
          </p>
          <p>
            {event.before ? formatCad(event.before.amountCents) : 'Création'} →{' '}
            {event.after
              ? `${formatCad(event.after.amountCents)} · ${event.after.entryDate}`
              : 'Suppression'}
          </p>
          {event.after?.note && <p>{event.after.note}</p>}
        </div>
      ))}
    </section>
  )
}
