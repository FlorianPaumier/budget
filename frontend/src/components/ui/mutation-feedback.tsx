import { useQueryClient } from '@tanstack/react-query'
import { isUncertain } from '../../lib/errors'
import { Feedback } from './feedback'
export function MutationFeedback({
  mutation,
  error,
}: {
  mutation: { error: unknown; reset: () => void }
  error?: unknown
}) {
  const cache = useQueryClient()
  return (
    <>
      <Feedback error={error || mutation.error} />
      {isUncertain(mutation.error) && (
        <button
          type="button"
          onClick={async () => {
            await cache.invalidateQueries()
            if (
              window.confirm(
                'Avez-vous vérifié les données du serveur pour éviter un doublon ?',
              )
            )
              mutation.reset()
          }}
        >
          J’ai vérifié les données actualisées
        </button>
      )}
    </>
  )
}
