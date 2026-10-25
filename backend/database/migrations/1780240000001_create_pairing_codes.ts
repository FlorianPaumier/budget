import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('pairing_codes', (table) => {
      table.uuid('id').primary()
      table.uuid('household_id').notNullable().references('id').inTable('households')
      table.string('code_hash', 128).notNullable().unique()
      table.timestamp('expires_at').notNullable()
      table.timestamp('used_at').nullable()
      table.timestamp('created_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable('pairing_codes')
  }
}
