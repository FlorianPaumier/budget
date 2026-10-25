import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { registerDistributionRoutes } from './distribution_routes.js'
import { registerLedgerRoutes } from './ledger_routes.js'
import { registerRecurrenceRoutes } from './recurrence_routes.js'
import { registerSyncRoutes } from './sync_routes.js'
import { registerPlanningRoutes } from './planning_routes.js'
import { registerDocumentationRoutes } from './documentation_routes.js'

const HealthController = () => import('#controllers/health_controller')
const HouseholdsController = () => import('#controllers/households_controller')
const PairingController = () => import('#controllers/pairing_controller')
const DevicesController = () => import('#controllers/devices_controller')

router.get('/api/v1/health', [HealthController, 'show']).as('health.show')
router.post('/api/v1/bootstrap', [HouseholdsController, 'bootstrap']).as('households.bootstrap')
router.post('/api/v1/pair', [PairingController, 'pair']).as('pairing.pair')

router
  .get('/api/v1/household', [HouseholdsController, 'show'])
  .as('households.show')
  .use(middleware.deviceAuth())
router
  .patch('/api/v1/household', [HouseholdsController, 'update'])
  .as('households.update')
  .use(middleware.deviceAuth())
router
  .get('/api/v1/devices', [DevicesController, 'index'])
  .as('devices.index')
  .use(middleware.deviceAuth())
router
  .patch('/api/v1/devices/:id', [DevicesController, 'update'])
  .as('devices.update')
  .use(middleware.deviceAuth())
router
  .delete('/api/v1/devices/:id', [DevicesController, 'destroy'])
  .as('devices.destroy')
  .use(middleware.deviceAuth())
router
  .post('/api/v1/pairing-codes', [PairingController, 'createCode'])
  .as('pairing.createCode')
  .use(middleware.deviceAuth())
router
  .delete('/api/v1/pairing-codes', [PairingController, 'invalidateCodes'])
  .as('pairing.invalidateCodes')
  .use(middleware.deviceAuth())

registerDistributionRoutes()
registerLedgerRoutes()
registerRecurrenceRoutes()
registerSyncRoutes()
registerPlanningRoutes()
registerDocumentationRoutes()
