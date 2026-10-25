import { DateTime } from 'luxon'

export function householdDate(instant: Date, timeZone: string): string {
  return DateTime.fromJSDate(instant).setZone(timeZone).toISODate()!
}
