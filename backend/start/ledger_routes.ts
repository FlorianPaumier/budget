import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const CategoriesController = () => import('#controllers/categories_controller')
const EntriesController = () => import('#controllers/entries_controller')
const BalancesController = () => import('#controllers/balances_controller')

export function registerLedgerRoutes() {
  router
    .get('/api/v1/categories', [CategoriesController, 'index'])
    .as('categories.index')
    .use(middleware.deviceAuth())
  router
    .post('/api/v1/categories', [CategoriesController, 'store'])
    .as('categories.store')
    .use(middleware.deviceAuth())
  router
    .patch('/api/v1/categories/:id', [CategoriesController, 'update'])
    .as('categories.update')
    .use(middleware.deviceAuth())
  router
    .delete('/api/v1/categories/:id', [CategoriesController, 'destroy'])
    .as('categories.destroy')
    .use(middleware.deviceAuth())

  router
    .get('/api/v1/entries', [EntriesController, 'index'])
    .as('entries.index')
    .use(middleware.deviceAuth())
  router
    .post('/api/v1/entries', [EntriesController, 'store'])
    .as('entries.store')
    .use(middleware.deviceAuth())
  router
    .get('/api/v1/entries/:id/history', [EntriesController, 'history'])
    .as('entries.history')
    .use(middleware.deviceAuth())
  router
    .get('/api/v1/entries/:id', [EntriesController, 'show'])
    .as('entries.show')
    .use(middleware.deviceAuth())
  router
    .patch('/api/v1/entries/:id', [EntriesController, 'update'])
    .as('entries.update')
    .use(middleware.deviceAuth())
  router
    .delete('/api/v1/entries/:id', [EntriesController, 'destroy'])
    .as('entries.destroy')
    .use(middleware.deviceAuth())

  router
    .get('/api/v1/balances', [BalancesController, 'show'])
    .as('balances.show')
    .use(middleware.deviceAuth())
  router
    .get('/api/v1/months/:month/actuals', [BalancesController, 'actuals'])
    .as('balances.actuals')
    .use(middleware.deviceAuth())
}
