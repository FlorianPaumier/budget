import { expect, it } from 'vitest'
import { endpoint } from './endpoint'
it('uses generated Adonis method, params and query definitions', () => {
  expect(
    endpoint('monthly_plans.show', { params: { month: '2026-10' } }),
  ).toEqual({ path: '/months/2026-10/plan', options: { method: 'GET' } })
  expect(
    endpoint('entries.update', {
      params: { id: 'entry-id' },
      body: { revision: 3, note: 'Correction' },
    }),
  ).toEqual({
    path: '/entries/entry-id',
    options: { method: 'PATCH', body: '{"revision":3,"note":"Correction"}' },
  })
  expect(endpoint('entries.index', { query: { month: '2026-10' } }).path).toBe(
    '/entries?month=2026-10',
  )
})
