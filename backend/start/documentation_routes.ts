import router from '@adonisjs/core/services/router'

const DocsController = () => import('#controllers/docs_controller')

export function registerDocumentationRoutes(): void {
  router.get('/docs', [DocsController, 'index']).as('docs.index')
  router.get('/openapi/v1.json', [DocsController, 'spec']).as('docs.spec')
}
