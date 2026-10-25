import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('monthly_plans', (table) => {
      table.uuid('id').primary()
      table.uuid('household_id').notNullable().references('id').inTable('households')
      table.string('month', 7).notNullable()
      table.bigInteger('savings_target_cents').nullable()
      table.integer('revision').notNullable().defaultTo(1)
      table.unique(['household_id', 'month'])
    })
  }

  async down() {
    this.schema.dropTable('monthly_plans')
  }
}
