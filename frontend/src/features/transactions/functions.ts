import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { apiRequest } from '../../server/api'
import { result } from '../../server/result'
import {
  uuid,
  revision,
  entryInputSchema,
  entrySchema,
  historySchema,
} from '../../lib/schemas'
export const createEntry = createServerFn({ method: 'POST' })
  .validator(entryInputSchema)
  .handler(({ data }) =>
    result(() => apiRequest('entries.store', { body: data }, entrySchema)),
  )
export const updateEntry = createServerFn({ method: 'POST' })
  .validator(z.object({ id: uuid, revision, input: entryInputSchema }))
  .handler(({ data }) =>
    result(() =>
      apiRequest(
        'entries.update',
        {
          params: { id: data.id },
          body: { ...data.input, revision: data.revision },
        },
        entrySchema,
      ),
    ),
  )
export const deleteEntry = createServerFn({ method: 'POST' })
  .validator(z.object({ id: uuid, revision }))
  .handler(({ data }) =>
    result(() =>
      apiRequest(
        'entries.destroy',
        { params: { id: data.id }, body: { revision: data.revision } },
        z.null(),
      ),
    ),
  )
export const getEntry = createServerFn({ method: 'GET' })
  .validator(uuid)
  .handler(({ data }) =>
    result(() =>
      apiRequest('entries.show', { params: { id: data } }, entrySchema),
    ),
  )
export const getHistory = createServerFn({ method: 'GET' })
  .validator(uuid)
  .handler(({ data }) =>
    result(() =>
      apiRequest(
        'entries.history',
        { params: { id: data } },
        z.array(historySchema),
      ),
    ),
  )
