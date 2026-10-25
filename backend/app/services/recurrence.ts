import { DateTime } from 'luxon'

export type RecurrenceRule = {
  startsOn: string
  endsOn?: string | null
  frequency: 'daily' | 'weekly' | 'biweekly' | 'twice_monthly' | 'monthly' | 'yearly'
  interval: number
  scheduleDetails?: { days: [number, number] } | null
}

/** Dates are household calendar dates, independent of the server's time zone. */
export function datesForRule(rule: RecurrenceRule, from: string, through: string): string[] {
  if (
    !['daily', 'weekly', 'biweekly', 'twice_monthly', 'monthly', 'yearly'].includes(rule.frequency)
  )
    throw new Error('Invalid frequency')
  if (!Number.isInteger(rule.interval) || rule.interval < 1) throw new Error('Invalid interval')
  const start = DateTime.fromISO(rule.startsOn, { zone: 'utc' })
  const first = DateTime.fromISO(from, { zone: 'utc' })
  const last = DateTime.fromISO(through, { zone: 'utc' })
  if (!start.isValid || !first.isValid || !last.isValid || first > last)
    throw new Error('Invalid date range')
  const end = rule.endsOn ? DateTime.fromISO(rule.endsOn, { zone: 'utc' }) : last
  if (!end.isValid) throw new Error('Invalid end date')
  const limit = end < last ? end : last
  const result: string[] = []
  const add = (date: DateTime) => {
    if (date >= start && date >= first && date <= limit) result.push(date.toISODate()!)
  }
  if (rule.frequency === 'twice_monthly') {
    const days = rule.scheduleDetails?.days
    if (
      !days ||
      days.length !== 2 ||
      days.some((day) => !Number.isInteger(day) || day < 1 || day > 31)
    )
      throw new Error('Invalid twice-monthly days')
    for (let month = start.startOf('month'); month <= limit; month = month.plus({ months: 1 })) {
      for (const day of days) add(month.set({ day: Math.min(day, month.daysInMonth!) }))
    }
  } else {
    const unit =
      rule.frequency === 'daily'
        ? 'days'
        : rule.frequency === 'weekly' || rule.frequency === 'biweekly'
          ? 'weeks'
          : rule.frequency === 'monthly'
            ? 'months'
            : 'years'
    const step = rule.interval * (rule.frequency === 'biweekly' ? 2 : 1)
    for (let i = 0; ; i++) {
      const anchor = start.plus({ [unit]: i * step })
      const date =
        unit === 'months' || unit === 'years'
          ? anchor.set({ day: Math.min(start.day, anchor.daysInMonth!) })
          : anchor
      if (date > limit) break
      add(date)
    }
  }
  return [...new Set(result)].sort()
}
