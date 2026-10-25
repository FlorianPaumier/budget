import { configApp } from '@adonisjs/eslint-config'
export default configApp().concat({
  // Lucid regenerates this file during migrations; its formatting is not application-owned.
  ignores: ['database/schema.ts'],
})
