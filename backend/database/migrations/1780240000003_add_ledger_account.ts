import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('ledger_entries', (table) => {
      table.string('account', 16).nullable()
    })
  }

  async down() {
    this.schema.alterTable('ledger_entries', (table) => {
      table.dropColumn('account')
    })
  }
}
