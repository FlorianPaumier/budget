import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    await this.schema.dropTableIfExists('auth_access_tokens')
    await this.schema.dropTableIfExists('users')
  }

  async down() {
    // Starter authentication is intentionally retired. Restoring it would
    // require reinstalling the old code and recovering its data from backup.
  }
}
