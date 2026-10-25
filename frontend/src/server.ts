import { randomBytes, randomUUID } from 'node:crypto'
import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'
import { getEnv } from './server/env'
const handler = createStartHandler(defaultStreamHandler)
export default {
  async fetch(request: Request) {
    const env = getEnv()
    const url = new URL(request.url)
    if (url.pathname === '/healthz') return Response.json({ status: 'ok' })
    const nonce = randomBytes(18).toString('base64')
    const id = randomUUID()
    const start = Date.now()
    request.headers.set('x-budget-nonce', nonce)
    const response = await handler(request)
    response.headers.set('Cache-Control', 'no-store')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('Referrer-Policy', 'no-referrer')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-Request-ID', id)
    response.headers.set(
      'Content-Security-Policy',
      `default-src 'self'; script-src 'self' 'nonce-${nonce}'${env.NODE_ENV === 'production' ? '' : " 'unsafe-inline'"}; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'${env.NODE_ENV === 'production' ? '' : ' ws: http:'}; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`,
    )
    console.info(
      JSON.stringify({
        requestId: id,
        operation: request.method,
        status: response.status,
        durationMs: Date.now() - start,
      }),
    )
    return response
  },
}
