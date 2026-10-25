import { queryOptions } from '@tanstack/react-query'
import { getMonth, getHousehold } from './functions'
import { unwrap } from '../../lib/errors'
export const householdQuery = (householdId: string) =>
  queryOptions({
    queryKey: [householdId, 'household'],
    queryFn: async () => unwrap(await getHousehold()),
  })
export const monthQuery = (householdId: string, month: string) =>
  queryOptions({
    queryKey: [householdId, 'month', month],
    queryFn: async () => unwrap(await getMonth({ data: { month } })),
  })
