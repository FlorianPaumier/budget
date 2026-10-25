export function estimateResource(row: Record<string, any>) {
  return {
    id: row.id,
    categoryId: row.category_id,
    month: row.month,
    amountCents: Number(row.amount_cents),
    revision: Number(row.revision),
  }
}

export function savingsTargetResource(row: Record<string, any>) {
  return {
    id: row.id,
    month: row.month,
    amountCents: row.savings_target_cents === null ? null : Number(row.savings_target_cents),
    revision: Number(row.revision),
  }
}
