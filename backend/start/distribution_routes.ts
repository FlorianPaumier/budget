import router from '@adonisjs/core/services/router'

const DistributionController = () => import('#controllers/distribution_controller')

/** Public Android distribution only. No household data or pairing credentials. */
export function registerDistributionRoutes(): void {
  router.get('/install', [DistributionController, 'index']).as('distribution.index')
  router
    .get('/install/version.json', [DistributionController, 'version'])
    .as('distribution.version')
  router.get('/install/budget.apk', [DistributionController, 'apk']).as('distribution.apk')
}
