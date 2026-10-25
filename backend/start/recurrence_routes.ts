import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const RecurringRulesController = () => import('#controllers/recurring_rules_controller')
const OccurrencesController = () => import('#controllers/occurrences_controller')

export function registerRecurrenceRoutes() {
  router
    .group(() => {
      router
        .get('/api/v1/recurring-rules', [RecurringRulesController, 'index'])
        .as('recurring_rules.index')
      router
        .get('/api/v1/recurring-rules/:id', [RecurringRulesController, 'show'])
        .as('recurring_rules.show')
      router
        .post('/api/v1/recurring-rules', [RecurringRulesController, 'store'])
        .as('recurring_rules.store')
      router
        .patch('/api/v1/recurring-rules/:id', [RecurringRulesController, 'update'])
        .as('recurring_rules.update')
      router
        .delete('/api/v1/recurring-rules/:id', [RecurringRulesController, 'destroy'])
        .as('recurring_rules.destroy')
      router.get('/api/v1/occurrences', [OccurrencesController, 'index']).as('occurrences.index')
      router
        .post('/api/v1/occurrences/:id/confirm', [OccurrencesController, 'confirm'])
        .as('occurrences.confirm')
    })
    .use(middleware.deviceAuth())
}
