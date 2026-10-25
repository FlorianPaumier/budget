import { expect, it } from 'vitest'
import { categoryStatus } from './status'
it('warns near the limit while distinguishing zero and exceeded budgets', () => {
  expect(categoryStatus(80, 100)).toBe('Près de la limite')
  expect(categoryStatus(79, 100)).toBe('Dans le budget')
  expect(categoryStatus(100, 100)).toBe('Budget atteint')
  expect(categoryStatus(101, 100)).toBe('Budget dépassé')
  expect(categoryStatus(0, 0)).toBe('Aucun budget prévu')
})
