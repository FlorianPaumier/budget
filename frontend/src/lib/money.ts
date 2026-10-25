export function parseCadCents(input: string): number {
  const value = input.trim()
  if (!/^-?\d+(?:[.,]\d{1,2})?$/.test(value))
    throw new Error('Saisissez un montant avec au plus deux décimales.')
  const [whole, fraction = ''] = value.replace('-', '').split(/[.,]/)
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
  const signed = value.startsWith('-') ? -cents : cents
  if (
    signed > BigInt(Number.MAX_SAFE_INTEGER) ||
    signed < BigInt(Number.MIN_SAFE_INTEGER)
  )
    throw new Error('Montant trop élevé.')
  return Number(signed)
}
export function formatCad(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new Error('Montant invalide.')
  const value = BigInt(cents)
  const whole = value / 100n
  const fraction = (value < 0n ? -value % 100n : value % 100n)
    .toString()
    .padStart(2, '0')
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' })
    .formatToParts(cents < 0 && whole === 0n ? -0 : whole)
    .map((part) => (part.type === 'fraction' ? fraction : part.value))
    .join('')
}
export function inputCad(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new Error('Montant invalide.')
  const value = BigInt(cents)
  const absolute = value < 0n ? -value : value
  return `${value < 0n ? '-' : ''}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, '0')}`
}

export function sumCents(values: number[]): number {
  const sum = values.reduce((total, value) => total + BigInt(value), 0n)
  if (
    sum > BigInt(Number.MAX_SAFE_INTEGER) ||
    sum < BigInt(Number.MIN_SAFE_INTEGER)
  )
    throw new Error('Total trop élevé.')
  return Number(sum)
}
