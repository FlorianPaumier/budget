import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('households', (table) => {
      table.uuid('id').primary()
      table.string('currency', 3).notNullable().defaultTo('CAD')
      table.string('time_zone', 64).notNullable().defaultTo('America/Toronto')
      table.string('reminder_time', 5).notNullable().defaultTo('09:00')
      table.bigInteger('opening_spendable_cents').notNullable().defaultTo(0)
      table.bigInteger('opening_savings_cents').notNullable().defaultTo(0)
      table.bigInteger('monthly_savings_target_cents').nullable()
      table.date('opening_date').notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })

    this.schema.createTable('devices', (table) => {
      table.uuid('id').primary()
      table.uuid('household_id').notNullable().references('id').inTable('households')
      table.string('label', 120).notNullable()
      table.string('credential_hash', 128).notNullable().unique()
      table.timestamp('paired_at').notNullable()
      table.timestamp('revoked_at').nullable()
    })

    this.schema.createTable('categories', (table) => {
      table.uuid('id').primary()
      table.uuid('household_id').notNullable().references('id').inTable('households')
      table.string('name', 120).notNullable()
      table.boolean('active').notNullable().defaultTo(true)
      table.integer('revision').notNullable().defaultTo(1)
      table.timestamp('deleted_at').nullable()
      table.unique(['household_id', 'name'])
    })

    this.schema.createTable('monthly_estimates', (table) => {
      table.uuid('id').primary()
      table.uuid('household_id').notNullable().references('id').inTable('households')
      table.uuid('category_id').notNullable().references('id').inTable('categories')
      table.string('month', 7).notNullable()
      table.bigInteger('amount_cents').notNullable()
      table.integer('revision').notNullable().defaultTo(1)
      table.timestamp('deleted_at').nullable()
      table.unique(['category_id', 'month'])
    })

    this.schema.createTable('recurring_rules', (table) => {
      table.uuid('id').primary()
      table.uuid('household_id').notNullable().references('id').inTable('households')
      table.string('kind', 20).notNullable() // income, bill, subscription
      table.string('name', 160).notNullable()
      table.uuid('category_id').nullable().references('id').inTable('categories')
      table.bigInteger('amount_cents').notNullable()
      table.string('frequency', 20).notNullable()
      table.integer('interval').notNullable().defaultTo(1)
      table.date('starts_on').notNullable()
      table.date('ends_on').nullable()
      table.string('schedule_details').nullable() // JSON for twice-monthly days
      table.boolean('active').notNullable().defaultTo(true)
      table.integer('revision').notNullable().defaultTo(1)
      table.timestamp('deleted_at').nullable()
    })

    this.schema.createTable('occurrences', (table) => {
      table.uuid('id').primary()
      table.uuid('household_id').notNullable().references('id').inTable('households')
      table.uuid('rule_id').notNullable().references('id').inTable('recurring_rules')
      table.date('expected_date').notNullable()
      table.bigInteger('expected_amount_cents').notNullable()
      table.string('status', 24).notNullable().defaultTo('expected')
      table.date('actual_date').nullable()
      table.bigInteger('actual_amount_cents').nullable()
      table.string('confirmation_method', 16).nullable() // manual, automatic
      table.boolean('needs_review').notNullable().defaultTo(false)
      table.integer('revision').notNullable().defaultTo(1)
      table.timestamp('deleted_at').nullable()
      table.unique(['rule_id', 'expected_date'])
    })

    this.schema.createTable('ledger_entries', (table) => {
      table.uuid('id').primary()
      table.uuid('household_id').notNullable().references('id').inTable('households')
      table.uuid('occurrence_id').nullable().unique().references('id').inTable('occurrences')
      table.uuid('category_id').nullable().references('id').inTable('categories')
      table.date('entry_date').notNullable()
      table.string('kind', 24).notNullable() // income, expense, category_adjustment, savings_transfer, balance_adjustment
      table.bigInteger('amount_cents').notNullable()
      table.string('note', 500).nullable()
      table.integer('revision').notNullable().defaultTo(1)
      table.timestamp('deleted_at').nullable()
      table.index(['household_id', 'entry_date'])
    })

    this.schema.createTable('change_events', (table) => {
      table.uuid('id').primary()
      table.uuid('household_id').notNullable().references('id').inTable('households')
      table.uuid('device_id').nullable().references('id').inTable('devices')
      table.string('entity_type', 40).notNullable()
      table.uuid('entity_id').notNullable()
      table.integer('before_revision').nullable()
      table.integer('after_revision').nullable()
      table.string('operation_id', 100).nullable().unique()
      table.timestamp('created_at').notNullable()
    })

    this.schema.createTable('sync_conflicts', (table) => {
      table.uuid('id').primary()
      table.uuid('household_id').notNullable().references('id').inTable('households')
      table.uuid('device_id').notNullable().references('id').inTable('devices')
      table.string('entity_type', 40).notNullable()
      table.uuid('entity_id').notNullable()
      table.text('server_value').notNullable()
      table.text('proposed_value').notNullable()
      table.string('status', 16).notNullable().defaultTo('open')
      table.timestamp('created_at').notNullable()
      table.timestamp('resolved_at').nullable()
    })
  }

  async down() {
    for (const table of [
      'sync_conflicts',
      'change_events',
      'ledger_entries',
      'occurrences',
      'recurring_rules',
      'monthly_estimates',
      'categories',
      'devices',
      'households',
    ]) {
      this.schema.dropTable(table)
    }
  }
}
