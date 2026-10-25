import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { pair } from '../features/access/functions'
import { unwrap, errorMessage } from '../lib/errors'
import { House, ArrowRight, ShieldCheck } from 'lucide-react'
export const Route = createFileRoute('/pair')({
  validateSearch: (
    search: Record<string, unknown>,
  ): { revocation?: string } => ({
    revocation: search.revocation === 'failed' ? 'failed' : undefined,
  }),
  component: PairPage,
})
function PairPage() {
  const { revocation } = Route.useSearch()
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const router = useRouter(),
    cache = useQueryClient()
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      unwrap(
        await pair({
          data: {
            pairingCode: String(form.get('code')).trim(),
            label: String(form.get('label')).trim(),
          },
        }),
      )
      await cache.cancelQueries()
      cache.clear()
      await router.invalidate()
      await router.navigate({ to: '/overview' })
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="pair-layout">
      <div className="pair-story">
        <div className="brand">
          <House aria-hidden="true" /> foyer<span>Budget du ménage</span>
        </div>
        <p className="eyebrow">UN PEU PLUS DE CLARTÉ</p>
        <h1>
          Votre quotidien.
          <br />
          Vos projets.
          <br />
          <em>Un budget partagé.</em>
        </h1>
        <p>
          Retrouvez vos comptes, vos dépenses et vos objectifs au même endroit.
        </p>
        <div className="trust">
          <ShieldCheck aria-hidden="true" />
          <span>Vos données restent sur votre serveur.</span>
        </div>
      </div>
      <section className="pair-card">
        <p className="eyebrow">BIENVENUE CHEZ VOUS</p>
        <h2>Associer ce navigateur</h2>
        {revocation && (
          <p role="status" className="notice">
            Ce navigateur est déconnecté, mais la révocation a échoué. Retirez
            cet appareil depuis un autre appareil associé.
          </p>
        )}
        <p>
          Depuis un appareil déjà associé, créez un code dans les paramètres du
          ménage. Il est valable cinq minutes.
        </p>
        <details>
          <summary>Aucun appareil déjà associé ?</summary>
          <p>
            Sur l’ordinateur qui héberge votre budget, ouvrez un terminal dans
            le dossier backend et exécutez :
          </p>
          <pre className="code overflow-x-auto">
            docker compose exec budget node build/ace.js pairing:code
          </pre>
          <p>
            Collez ensuite le code dans le champ d’association. Sans Docker,
            utilisez <code>node ace.js pairing:code</code> avec la configuration
            de votre serveur. Votre ménage et ses données sont conservés.
          </p>
        </details>
        <form onSubmit={submit}>
          <label>
            Nom de cet appareil
            <input
              name="label"
              defaultValue="Ordinateur du foyer"
              required
              maxLength={120}
              autoComplete="off"
            />
          </label>
          <label>
            Code d’association
            <input
              name="code"
              required
              minLength={32}
              maxLength={256}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="primary w-full" disabled={busy}>
            {busy ? 'Association…' : 'Ouvrir mon budget'}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </form>
        <p className="muted text-sm">
          Aucun compte supplémentaire. Utilisez votre ménage existant.
        </p>
      </section>
    </main>
  )
}
