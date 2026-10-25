import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('sync_receipts', (table) => {
      table.string('operation_id', 100).primary()
      table.uuid('household_id').notNullable().references('id').inTable('households')
      table.uuid('device_id').notNullable().references('id').inTable('devices')
      table.string('entity_type', 40).notNullable()
      table.uuid('entity_id').notNullable()
      table.string('status', 20).notNullable()
      table.integer('revision').nullable()
      table.uuid('conflict_id').nullable()
      table.timestamp('created_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable('sync_receipts')
  }
}
