import { errorMessage, RequestFailure } from '../../lib/errors'
const fieldLabels: Record<string, string> = {
  amountCents: 'Montant',
  actualAmountCents: 'Montant réel',
  entryDate: 'Date',
  actualDate: 'Date réelle',
  name: 'Nom',
  note: 'Note',
  label: 'Nom de l’appareil',
  revision: 'Version des données',
  categoryId: 'Catégorie',
  account: 'Compte',
  reminderTime: 'Heure du rappel',
  startsOn: 'Date de début',
  endsOn: 'Date de fin',
  interval: 'Intervalle',
  frequency: 'Fréquence',
  scheduleDetails: 'Jours du mois',
}
export function Feedback({ error }: { error: unknown }) {
  if (!error) return null
  const fields =
    error instanceof RequestFailure ? error.failure.fieldErrors : {}
  return (
    <div className="error" role="alert">
      <p>{errorMessage(error)}</p>
      {Object.keys(fields).length > 0 && (
        <ul>
          {Object.keys(fields).map((field) => (
            <li key={field}>
              {fieldLabels[field] || 'Champ du formulaire'} : valeur invalide.
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
