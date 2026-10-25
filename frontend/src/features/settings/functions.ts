import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { apiRequest } from '../../server/api'
import { result } from '../../server/result'
import {
  categorySchema,
  deviceSchema,
  householdSchema,
  revision,
  uuid,
} from '../../lib/schemas'
const name = z.string().trim().min(1).max(120)
export const getDevices = createServerFn({ method: 'GET' }).handler(() =>
  result(() => apiRequest('devices.index', {}, z.array(deviceSchema))),
)
export const createCategory = createServerFn({ method: 'POST' })
  .validator(z.object({ name }))
  .handler(({ data }) =>
    result(() =>
      apiRequest('categories.store', { body: data }, categorySchema),
    ),
  )
export const updateCategory = createServerFn({ method: 'POST' })
  .validator(z.object({ id: uuid, revision, name, active: z.boolean() }))
  .handler(({ data: { id, ...body } }) =>
    result(() =>
      apiRequest('categories.update', { params: { id }, body }, categorySchema),
    ),
  )
export const deleteCategory = createServerFn({ method: 'POST' })
  .validator(z.object({ id: uuid, revision }))
  .handler(({ data: { id, ...body } }) =>
    result(() =>
      apiRequest('categories.destroy', { params: { id }, body }, z.null()),
    ),
  )
export const renameDevice = createServerFn({ method: 'POST' })
  .validator(z.object({ id: uuid, label: name }))
  .handler(({ data: { id, ...body } }) =>
    result(() =>
      apiRequest('devices.update', { params: { id }, body }, deviceSchema),
    ),
  )
export const revokeDevice = createServerFn({ method: 'POST' })
  .validator(uuid)
  .handler(({ data }) =>
    result(() =>
      apiRequest('devices.destroy', { params: { id: data } }, z.null()),
    ),
  )
export const createPairingCode = createServerFn({ method: 'POST' }).handler(
  () =>
    result(() =>
      apiRequest(
        'pairing.createCode',
        {},
        z.object({
          pairingCode: z.string(),
          pairingUri: z.string(),
          expiresInSeconds: z.number(),
        }),
      ),
    ),
)
export const invalidatePairingCodes = createServerFn({
  method: 'POST',
}).handler(() =>
  result(() => apiRequest('pairing.invalidateCodes', {}, z.null())),
)
export const setReminder = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      reminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      revision,
    }),
  )
  .handler(({ data }) =>
    result(() =>
      apiRequest('households.update', { body: data }, householdSchema),
    ),
  )
