import { performMutation, isUncertain } from '../../lib/errors'
import { MutationFeedback } from '../../components/ui/mutation-feedback'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  PageHeading,
  QueryState,
  useMonthData,
} from '../../components/month-page'
import { useDraftGuard } from '../../components/use-draft-guard'
import { unwrap } from '../../lib/errors'
import {
  createCategory,
  updateCategory,
  deleteCategory,
  getDevices,
  renameDevice,
  revokeDevice,
  createPairingCode,
  invalidatePairingCodes,
  setReminder,
} from './functions'
import type { Category, Household } from '../../lib/schemas'
export function Settings() {
  const query = useMonthData(),
    { data, access } = query,
    cache = useQueryClient(),
    [newCategory, setNewCategory] = useState('')
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const categories = useMutation({
    mutationFn: async () =>
      performMutation(
        async () => await createCategory({ data: { name: newCategory } }),
      ),
    onSuccess: async () => {
      setNewCategory('')
      await cache.invalidateQueries()
    },
  })
  return (
    <>
      <PageHeading
        eyebrow="UN FOYER QUI VOUS RESSEMBLE"
        title="Paramètres"
        description="Les préférences partagées et les appareils de votre ménage."
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
              <h2>Votre espace</h2>
              <div className="stat-row">
                <span className="muted">Devise</span>
                <strong>Dollar canadien · CAD</strong>
              </div>
              <div className="stat-row">
                <span className="muted">Fuseau horaire</span>
                <strong>{data.household.timeZone}</strong>
              </div>
              <Appearance />
            </section>
            <section className="panel">
              <h2>Rappels du ménage</h2>
              <p className="muted text-sm leading-7 mt-3">
                Cette heure s’applique aux rappels de l’application Android. Ce
                navigateur n’envoie pas de notifications.
              </p>
              <ReminderEditor current={data.household} />
            </section>
          </div>
          <section className="panel">
            <div className="section-heading">
              <h2>Vos catégories</h2>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                categories.mutate()
              }}
            >
              <label>
                Nouvelle catégorie
                <input
                  disabled={categories.isPending}
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Ex. Épicerie"
                  maxLength={120}
                  required
                />
              </label>
              <button
                className="primary self-start"
                disabled={categories.isPending || isUncertain(categories.error)}
              >
                Ajouter la catégorie
              </button>
              <MutationFeedback mutation={categories} />
            </form>
            {editingCategory && (
              <CategorySetting
                key={editingCategory.id}
                category={editingCategory}
                onClose={() => setEditingCategory(null)}
              />
            )}
            {data.categories.map((category) => (
              <div className="stat-row" key={category.id}>
                <span>
                  {category.name}
                  {!category.active ? ' · Inactive' : ''}
                </span>
                <button
                  disabled={editingCategory !== null}
                  onClick={() => setEditingCategory(category)}
                >
                  Modifier {category.name}
                </button>
              </div>
            ))}
          </section>
          <Devices
            householdId={access.householdId}
            currentId={access.deviceId}
          />
          <PairingCodes />
        </>
      )}
    </>
  )
}
function Appearance() {
  function change(value: string) {
    try {
      localStorage.setItem('budget-theme', value)
    } catch {
      /* Preferences remain usable when storage is unavailable. */
    }
    if (value === 'system') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = value
  }
  return (
    <label className="mt-6">
      Apparence
      <select
        ref={(node) => {
          if (node)
            node.value = document.documentElement.dataset.theme || 'system'
        }}
        defaultValue="system"
        onChange={(e) => change(e.target.value)}
      >
        <option value="system">Selon le système</option>
        <option value="light">Clair</option>
        <option value="dark">Sombre</option>
      </select>
    </label>
  )
}
function CategorySetting({
  category,
  onClose,
}: {
  category: Category
  onClose: () => void
}) {
  const cache = useQueryClient(),
    [name, setName] = useState(category.name),
    [active, setActive] = useState(category.active)
  const save = useMutation({
    mutationFn: async () =>
      performMutation(
        async () =>
          await updateCategory({
            data: {
              id: category.id,
              revision: category.revision,
              name,
              active,
            },
          }),
      ),
    onSuccess: async () => {
      await cache.invalidateQueries()
      onClose()
    },
  })
  const remove = useMutation({
    mutationFn: async () =>
      performMutation(
        async () =>
          await deleteCategory({
            data: { id: category.id, revision: category.revision },
          }),
      ),
    onSuccess: async () => {
      await cache.invalidateQueries()
      onClose()
    },
  })
  const busy = save.isPending || remove.isPending
  useDraftGuard(name !== category.name || active !== category.active, busy)
  return (
    <div className="budget-row">
      <p className="muted">
        Votre brouillon conserve la version ouverte. Copiez-le puis fermez et
        rouvrez pour charger les changements du serveur.
      </p>
      <form
        className="m-0"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate()
        }}
      >
        <fieldset className="contents" disabled={busy}>
          <div className="form-grid">
            <label>
              Nom de la catégorie
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={120}
              />
            </label>
            <label className="flex-row items-center self-end pb-3">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              Active pour les nouvelles transactions
            </label>
          </div>
          <div className="actions">
            <button
              disabled={
                save.isPending ||
                isUncertain(save.error) ||
                remove.isPending ||
                isUncertain(remove.error)
              }
            >
              Enregistrer {category.name}
            </button>
            <button
              type="button"
              className="danger"
              disabled={
                save.isPending ||
                isUncertain(save.error) ||
                remove.isPending ||
                isUncertain(remove.error)
              }
              onClick={() => {
                if (
                  window.confirm(
                    `Supprimer la catégorie « ${category.name} » ? L’historique financier est conservé.`,
                  )
                )
                  remove.mutate()
              }}
            >
              Supprimer
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              if (
                (name === category.name && active === category.active) ||
                window.confirm('Abandonner ce brouillon ?')
              )
                onClose()
            }}
          >
            Annuler
          </button>
          <MutationFeedback mutation={save} />
          <MutationFeedback mutation={remove} />
        </fieldset>
      </form>
    </div>
  )
}
function Devices({
  householdId,
  currentId,
}: {
  householdId: string
  currentId: string
}) {
  const cache = useQueryClient(),
    query = useQuery({
      queryKey: [householdId, 'devices'],
      queryFn: async () => unwrap(await getDevices()),
    })
  const rename = useMutation({
    mutationFn: async (input: { id: string; label: string }) =>
      performMutation(async () => await renameDevice({ data: input })),
    onSuccess: () => cache.invalidateQueries(),
  })
  const revoke = useMutation({
    mutationFn: async (id: string) =>
      performMutation(async () => await revokeDevice({ data: id })),
    onSuccess: async (_value, id) => {
      if (id === currentId) {
        await cache.cancelQueries()
        cache.clear()
        window.location.assign('/pair')
      } else await cache.invalidateQueries()
    },
  })
  function submit(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault()
    rename.mutate({
      id,
      label: String(new FormData(event.currentTarget).get('label')),
    })
  }
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Appareils associés</h2>
        <span className="muted text-xs">
          Un accès révocable pour chaque appareil.
        </span>
      </div>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
      />
      <MutationFeedback mutation={rename} />
      <MutationFeedback mutation={revoke} />
      {query.data?.map((device) => (
        <div className="budget-row" key={device.id}>
          <p className="text-sm">
            <strong>{device.label}</strong>
            {device.id === currentId ? ' · Ce navigateur' : ''}
            {device.revokedAt ? ' · Accès révoqué' : ''}
          </p>
          {!device.revokedAt && (
            <form className="mb-0" onSubmit={(e) => submit(e, device.id)}>
              <label>
                Nouveau nom pour {device.label}
                <input
                  disabled={rename.isPending || revoke.isPending}
                  name="label"
                  defaultValue={device.label}
                  required
                  maxLength={120}
                />
              </label>
              <div className="actions">
                <button
                  disabled={
                    rename.isPending ||
                    isUncertain(rename.error) ||
                    revoke.isPending ||
                    isUncertain(revoke.error)
                  }
                >
                  Renommer
                </button>
                <button
                  type="button"
                  className="danger"
                  disabled={
                    rename.isPending ||
                    isUncertain(rename.error) ||
                    revoke.isPending ||
                    isUncertain(revoke.error)
                  }
                  onClick={() => {
                    if (
                      window.confirm(
                        `Révoquer l’accès de « ${device.label} » ?`,
                      )
                    )
                      revoke.mutate(device.id)
                  }}
                >
                  Révoquer l’accès
                </button>
              </div>
            </form>
          )}
        </div>
      ))}
    </section>
  )
}
function PairingCodes() {
  const [expires, setExpires] = useState(0)
  const create = useMutation({
    mutationFn: async () =>
      performMutation(async () => await createPairingCode()),
    onSuccess: (value) =>
      setExpires(Date.now() + value.expiresInSeconds * 1000),
  })
  const invalidate = useMutation({
    mutationFn: async () =>
      performMutation(async () => await invalidatePairingCodes()),
    onSuccess: () => create.reset(),
  })
  return (
    <section className="panel">
      <h2>Inviter un autre appareil</h2>
      <p className="muted text-sm leading-7 mt-3">
        Créez un code à usage unique et saisissez-le sur l’autre appareil. Ne le
        partagez qu’avec votre ménage.
      </p>
      <div className="actions mt-5">
        <button
          className="primary"
          disabled={
            create.isPending ||
            isUncertain(create.error) ||
            invalidate.isPending ||
            isUncertain(invalidate.error)
          }
          onClick={() => create.mutate()}
        >
          Créer un code d’association
        </button>
        <button
          disabled={invalidate.isPending || isUncertain(invalidate.error)}
          onClick={() => invalidate.mutate()}
        >
          Invalider les codes
        </button>
      </div>
      {create.data && (
        <div className="notice">
          <p className="code">{create.data.pairingCode}</p>
          <p className="muted text-xs mt-3">
            Expire à{' '}
            {new Intl.DateTimeFormat('fr-CA', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }).format(expires)}{' '}
            · une seule utilisation.
          </p>
        </div>
      )}
      <MutationFeedback mutation={create} />
      <MutationFeedback mutation={invalidate} />
    </section>
  )
}

function ReminderEditor({ current }: { current: Household }) {
  const [base, setBase] = useState(current),
    [time, setTime] = useState(current.reminderTime),
    cache = useQueryClient()
  const dirty = time !== base.reminderTime
  const mutation = useMutation({
    mutationFn: () =>
      performMutation(() =>
        setReminder({ data: { reminderTime: time, revision: base.revision } }),
      ),
    onSuccess: async (value) => {
      setBase(value)
      setTime(value.reminderTime)
      await cache.invalidateQueries()
    },
  })
  useDraftGuard(dirty, mutation.isPending)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        mutation.mutate()
      }}
    >
      <fieldset className="contents" disabled={mutation.isPending}>
        <label>
          Heure locale du ménage
          <input
            name="time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
          />
        </label>
        {current.revision !== base.revision && (
          <div className="notice">
            <p>Le ménage a changé. Votre brouillon est conservé.</p>
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
                setTime(current.reminderTime)
                mutation.reset()
              }}
            >
              Charger l’heure actuelle
            </button>
          </div>
        )}
        <MutationFeedback mutation={mutation} />
        <button
          className="primary self-start"
          disabled={mutation.isPending || isUncertain(mutation.error)}
        >
          Enregistrer l’heure
        </button>
      </fieldset>
    </form>
  )
}
