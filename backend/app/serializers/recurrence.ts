export function ruleResource(row: Record<string, any>) {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    categoryId: row.category_id,
    amountCents: Number(row.amount_cents),
    frequency: row.frequency,
    interval: Number(row.interval),
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    scheduleDetails: row.schedule_details ? JSON.parse(row.schedule_details) : null,
    active: Boolean(row.active),
    revision: Number(row.revision),
  }
}

export function occurrenceResource(row: Record<string, any>) {
  return {
    id: row.id,
    ruleId: row.rule_id,
    ruleName: row.ruleName,
    ruleKind: row.ruleKind,
    expectedDate: row.expected_date,
    expectedAmountCents: Number(row.expected_amount_cents),
    status: row.status,
    displayStatus: row.displayStatus,
    actualDate: row.actual_date,
    actualAmountCents: row.actual_amount_cents === null ? null : Number(row.actual_amount_cents),
    confirmationMethod: row.confirmation_method,
    needsReview: Boolean(row.needs_review),
    revision: Number(row.revision),
  }
}
