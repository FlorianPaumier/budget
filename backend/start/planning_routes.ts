import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const MonthlyPlansController = () => import('#controllers/monthly_plans_controller')

export function registerPlanningRoutes() {
  router
    .group(() => {
      router.put('/api/v1/months/:month/estimates/:categoryId', [
        MonthlyPlansController,
        'setEstimate',
      ])
      router.put('/api/v1/months/:month/savings-target', [
        MonthlyPlansController,
        'setSavingsTarget',
      ])
      router
        .get('/api/v1/months/:month/plan', [MonthlyPlansController, 'show'])
        .as('monthly_plans.show')
      router.get('/api/v1/months/:month/suggestions/:categoryId', [
        MonthlyPlansController,
        'suggestion',
      ])
    })
    .use(middleware.deviceAuth())
}
