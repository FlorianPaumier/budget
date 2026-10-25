/** Labels category spending against its accepted estimate; all amounts are cents. */
export function categoryStatus(
  spentCents: number,
  estimateCents: number,
): string {
  if (spentCents > estimateCents) return 'Budget dépassé'
  if (estimateCents === 0) return 'Aucun budget prévu'
  if (spentCents === estimateCents) return 'Budget atteint'
  if (spentCents >= estimateCents * 0.8) return 'Près de la limite'
  return 'Dans le budget'
}
