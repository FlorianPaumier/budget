export function householdResource(row: Record<string, any>) {
  return {
    id: row.id,
    currency: row.currency,
    timeZone: row.time_zone,
    reminderTime: row.reminder_time,
    openingSpendableCents: Number(row.opening_spendable_cents),
    openingSavingsCents: Number(row.opening_savings_cents),
    openingDate: row.opening_date,
    monthlySavingsTargetCents:
      row.monthly_savings_target_cents === null || row.monthly_savings_target_cents === undefined
        ? null
        : Number(row.monthly_savings_target_cents),
    revision: Number(row.revision),
  }
}

export function deviceResource(row: Record<string, any>) {
  return { id: row.id, label: row.label, pairedAt: row.paired_at, revokedAt: row.revoked_at }
}
