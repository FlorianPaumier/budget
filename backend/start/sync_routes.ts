import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const SyncController = () => import('#controllers/sync_controller')

export function registerSyncRoutes() {
  router
    .group(() => {
      router.post('/push', [SyncController, 'push']).as('sync.push')
      router.get('/changes', [SyncController, 'changes']).as('sync.changes')
      router.get('/conflicts', [SyncController, 'conflicts']).as('sync.conflicts')
      router.post('/conflicts/:id/resolve', [SyncController, 'resolve']).as('sync.resolve')
    })
    .prefix('/api/v1/sync')
    .use(middleware.deviceAuth())
}
