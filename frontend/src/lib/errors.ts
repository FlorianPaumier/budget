export type Failure = {
  code: string
  status: number
  fieldErrors: Record<string, string>
  outcomeUncertain: boolean
}
export type Result<T> = { ok: true; value: T } | { ok: false; error: Failure }
export class RequestFailure extends Error {
  constructor(public failure: Failure) {
    super(failure.code)
  }
}
export function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new RequestFailure(result.error)
  return result.value
}
export function errorMessage(error: unknown): string {
  if (error instanceof RequestFailure) {
    const f = error.failure
    if (f.outcomeUncertain)
      return 'Le résultat de cet enregistrement est incertain. Actualisez les données et vérifiez avant de recommencer.'
    if (f.status === 409)
      return 'Ces données ont changé sur un autre appareil. Consultez la version actuelle avant de réappliquer votre brouillon.'
    if (f.status === 404)
      return 'Cet élément a été supprimé ou est introuvable. Votre brouillon est conservé.'
    if (f.status === 401)
      return 'Votre accès a expiré ou a été révoqué. Associez de nouveau ce navigateur.'
    if (f.status === 410) return 'Ce code est expiré ou a déjà été utilisé.'
    if (f.status === 429) return 'Trop de tentatives. Patientez une minute.'
    if (f.status === 422) return 'Vérifiez les champs indiqués.'
  }
  if (
    error instanceof Error &&
    !/^[A-Z_]+$/.test(error.message) &&
    error.message.length < 160
  )
    return error.message
  return 'Le serveur est indisponible. Réessayez lorsque la connexion est rétablie.'
}

export function isUncertain(error: unknown): boolean {
  return error instanceof RequestFailure && error.failure.outcomeUncertain
}
export async function performMutation<T>(
  operation: () => Promise<Result<T>>,
): Promise<T> {
  try {
    return unwrap(await operation())
  } catch (error) {
    if (error instanceof RequestFailure) throw error
    throw new RequestFailure({
      code: 'WRITE_UNCONFIRMED',
      status: 503,
      fieldErrors: {},
      outcomeUncertain: true,
    })
  }
}
