import { randomUUID } from 'node:crypto'
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('households', (table) => {
      table.uuid('sync_generation').notNullable().defaultTo(randomUUID())
    })
    this.schema.alterTable('sync_conflicts', (table) => {
      table.string('resolution_choice').nullable()
    })
  }

  async down() {
    this.schema.alterTable('sync_conflicts', (table) => table.dropColumn('resolution_choice'))
    this.schema.alterTable('households', (table) => table.dropColumn('sync_generation'))
  }
}
