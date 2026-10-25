import { createIsomorphicFn } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'
import { createRouter } from '@tanstack/react-router'
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { routeTree } from './routeTree.gen'
import { RequestFailure } from './lib/errors'
const requestNonce = createIsomorphicFn()
  .server(() => getRequestHeader('x-budget-nonce'))
  .client(() => undefined)
export function getRouter() {
  function clearRevokedSession(error: unknown) {
    if (
      typeof window !== 'undefined' &&
      error instanceof RequestFailure &&
      error.failure.status === 401
    ) {
      void queryClient.cancelQueries().then(() => {
        queryClient.clear()
        window.location.replace('/pair')
      })
    }
  }
  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError: clearRevokedSession }),
    mutationCache: new MutationCache({
      onError: (error) => {
        clearRevokedSession(error)
        void queryClient.invalidateQueries()
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (count, error) =>
          count < 1 &&
          !(error instanceof RequestFailure && error.failure.status < 500),
      },
      mutations: { retry: false, networkMode: 'always' },
    },
  })
  const router = createRouter({
    routeTree,
    ssr: { nonce: requestNonce() },
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  })
  setupRouterSsrQueryIntegration({ router, queryClient })
  return router
}
declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
