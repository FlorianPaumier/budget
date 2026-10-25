export function validMonth(value: string): boolean {
  return (
    /^\d{4}-(0[1-9]|1[0-2])$/.test(value) &&
    value.slice(0, 4) >= '1900' &&
    value.slice(0, 4) <= '9998'
  )
}
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !validMonth(value.slice(0, 7)))
    return false
  const date = new Date(`${value}T12:00:00Z`)
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  )
}
export function householdToday(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}
export function shiftMonth(month: string, offset: number): string {
  if (!validMonth(month)) throw new Error('Mois invalide.')
  const date = new Date(`${month}-15T12:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + offset)
  const result = date.toISOString().slice(0, 7)
  if (!validMonth(result)) throw new Error('Mois hors limites.')
  return result
}
export function monthEnd(month: string): string {
  if (!validMonth(month)) throw new Error('Mois invalide.')
  const date = new Date(`${month}-01T12:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + 1)
  date.setUTCDate(0)
  return date.toISOString().slice(0, 10)
}
export function activityThrough(month: string, today: string): string {
  return monthEnd(month) < today ? monthEnd(month) : today
}
export function formatMonth(month: string): string {
  return new Intl.DateTimeFormat('fr-CA', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}-15T12:00:00Z`))
}
export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('fr-CA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`))
}
