import { expect, it } from 'vitest'
import { sealData } from 'iron-session'
import { decodeSession } from './session-data'
const password = 'private-test-secret-at-least-thirty-two-characters'
const data = {
  credential: 'a'.repeat(43),
  deviceId: '64269ad3-a91e-4525-82e6-0af2d7ee7c23',
  householdId: '8d8158aa-42ca-493e-a019-7289c2e07152',
  expiresAt: 2000,
}
it('accepts a sealed session and rejects expiry, corruption and the wrong secret', async () => {
  const sealed = await sealData(data, { password, ttl: 604800 })
  expect(await decodeSession(sealed, password, 1000)).toEqual(data)
  expect(await decodeSession(sealed, password, 2001)).toEqual({})
  expect(
    await decodeSession(
      sealed.slice(0, 40) + 'changed' + sealed.slice(47),
      password,
      1000,
    ),
  ).toEqual({})
  expect(
    await decodeSession(
      sealed,
      'another-private-test-secret-with-thirty-two-characters',
      1000,
    ),
  ).toEqual({})
})
