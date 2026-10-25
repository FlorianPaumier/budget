import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('households', (table) => {
      table.integer('revision').notNullable().defaultTo(1)
    })
    this.schema.alterTable('change_events', (table) => {
      table.text('before_value').nullable()
      table.text('after_value').nullable()
    })
  }

  async down() {
    this.schema.alterTable('change_events', (table) => {
      table.dropColumn('before_value')
      table.dropColumn('after_value')
    })
    this.schema.alterTable('households', (table) => {
      table.dropColumn('revision')
    })
  }
}
