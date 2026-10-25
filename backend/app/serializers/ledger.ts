export function categoryResource(row: Record<string, any>) {
  return {
    id: row.id,
    name: row.name,
    active: Boolean(row.active),
    revision: Number(row.revision),
    deletedAt: row.deleted_at,
  }
}

export function entryResource(row: Record<string, any>) {
  return {
    id: row.id,
    kind: row.kind,
    entryDate: row.entry_date,
    amountCents: Number(row.amount_cents),
    categoryId: row.category_id,
    account: row.account,
    note: row.note,
    occurrenceId: row.occurrence_id,
    revision: Number(row.revision),
    deletedAt: row.deleted_at,
  }
}

export function entryHistoryResource(row: Record<string, any>) {
  return {
    id: row.id,
    deviceId: row.device_id,
    deviceLabel: row.device_label ?? null,
    beforeRevision: row.before_revision,
    afterRevision: row.after_revision,
    createdAt: row.created_at,
    before: row.before_value ? entryResource(JSON.parse(row.before_value)) : null,
    after: row.after_value ? entryResource(JSON.parse(row.after_value)) : null,
  }
}
