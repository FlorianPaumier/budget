import {
  createServerOnlyFn,
  createStart,
  createCsrfMiddleware,
  createMiddleware,
} from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { getEnv } from './server/env'
import { checkOrigin } from './server/security'
const allowedOrigin = createServerOnlyFn(
  (origin: string) => origin === getEnv().WEB_ORIGIN,
)
const originGuard = createMiddleware().server(async ({ next }) => {
  const request = getRequest()
  if (!['GET', 'HEAD'].includes(request.method)) {
    try {
      checkOrigin(request.headers.get('origin'), getEnv().WEB_ORIGIN)
    } catch {
      return new Response('Forbidden', { status: 403 })
    }
  }
  return next()
})
export const startInstance = createStart(() => ({
  requestMiddleware: [
    originGuard,
    createCsrfMiddleware({
      origin: allowedOrigin,
      filter: (ctx) => ctx.handlerType === 'serverFn',
    }),
  ],
}))
