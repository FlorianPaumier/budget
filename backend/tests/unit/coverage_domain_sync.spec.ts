import { test } from '@japa/runner'
import knex from 'knex'
import { randomUUID } from 'node:crypto'
import {
  pushOperation,
  listChanges,
  listConflicts,
  resolveConflict,
  type SyncOperation,
} from '../../app/services/sync.js'

async function fixture() {
  const database = knex({
    client: 'better-sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true,
  })
  await database.schema.createTable('categories', (t) => {
    t.string('id').primary()
    t.string('household_id')
    t.string('name')
    t.boolean('active')
    t.integer('revision')
    t.string('deleted_at')
  })
  await database.schema.createTable('households', (t) => {
    t.string('id').primary()
    t.integer('opening_spendable_cents')
    t.integer('opening_savings_cents')
    t.string('opening_date')
    t.string('time_zone')
  })
  await database.schema.createTable('recurring_rules', (t) => {
    t.string('id').primary()
    t.string('household_id')
    t.string('kind')
    t.string('name')
    t.string('category_id')
    t.integer('amount_cents')
    t.string('frequency')
    t.integer('interval')
    t.string('starts_on')
    t.string('ends_on')
    t.string('schedule_details')
    t.boolean('active')
    t.integer('revision')
    t.string('deleted_at')
  })
  await database.schema.createTable('occurrences', (t) => {
    t.string('id').primary()
    t.string('household_id')
    t.string('rule_id')
    t.string('expected_date')
    t.integer('expected_amount_cents')
    t.string('status')
    t.string('actual_date')
    t.integer('actual_amount_cents')
    t.string('confirmation_method')
    t.boolean('needs_review')
    t.integer('revision')
    t.string('deleted_at')
    t.unique(['rule_id', 'expected_date'])
  })
  await database.schema.createTable('ledger_entries', (t) => {
    t.string('id').primary()
    t.string('household_id')
    t.string('occurrence_id')
    t.string('category_id')
    t.string('entry_date')
    t.string('kind')
    t.integer('amount_cents')
    t.string('account')
    t.string('note')
    t.integer('revision')
    t.string('deleted_at')
  })
  await database.schema.createTable('change_events', (t) => {
    t.string('id').primary()
    t.string('household_id')
    t.string('device_id')
    t.string('entity_type')
    t.string('entity_id')
    t.integer('before_revision')
    t.integer('after_revision')
    t.string('operation_id').unique()
    t.text('before_value')
    t.text('after_value')
    t.string('created_at')
  })
  await database.schema.createTable('sync_conflicts', (t) => {
    t.string('id').primary()
    t.string('household_id')
    t.string('device_id')
    t.string('entity_type')
    t.string('entity_id')
    t.text('server_value')
    t.text('proposed_value')
    t.string('status')
    t.string('created_at')
    t.string('resolved_at')
    t.string('resolution_choice')
  })
  await database.schema.createTable('sync_receipts', (t) => {
    t.string('operation_id').primary()
    t.string('household_id')
    t.string('device_id')
    t.string('entity_type')
    t.string('entity_id')
    t.string('status')
    t.integer('revision')
    t.string('conflict_id')
    t.string('created_at')
  })
  await database.schema.createTable('monthly_estimates', (t) => {
    t.string('id').primary()
    t.string('household_id')
    t.string('category_id')
    t.string('month')
    t.integer('amount_cents')
    t.integer('revision')
    t.string('deleted_at')
  })
  await database.schema.createTable('monthly_plans', (t) => {
    t.string('id').primary()
    t.string('household_id')
    t.string('month')
    t.integer('savings_target_cents')
    t.integer('revision')
  })
  const householdId = randomUUID()
  await database('households').insert({
    id: householdId,
    opening_spendable_cents: 100000,
    opening_savings_cents: 50000,
    opening_date: '2026-01-01',
    time_zone: 'America/Toronto',
  })
  return { database, householdId, deviceId: randomUUID(), otherDeviceId: randomUUID() }
}

function createOperation(name = 'Food'): SyncOperation {
  return {
    operationId: randomUUID(),
    entityType: 'category',
    entityId: randomUUID(),
    action: 'create',
    baseRevision: 0,
    value: { name },
  }
}

test.group('sync operation boundaries', () => {
  test('rejects invalid envelopes and unsupported mutation types', async ({ assert }) => {
    const f = await fixture()
    try {
      const base = createOperation()
      for (const changes of [
        null,
        { operationId: 'bad' },
        { entityId: 'bad' },
        { entityType: 'unknown' },
        { action: 'unknown' },
        { baseRevision: -1 },
        { baseRevision: 0.5 },
        { baseRevision: 1 },
        { action: 'update', baseRevision: 0 },
        { entityType: 'occurrence' },
        { entityType: 'household' },
        { entityType: 'monthly_plan', action: 'delete', baseRevision: 1 },
        { value: undefined },
        { value: [] },
        { value: 'bad' },
      ])
        await assert.rejects(
          () =>
            pushOperation(
              f.database,
              f.householdId,
              f.deviceId,
              changes === null
                ? (null as unknown as SyncOperation)
                : ({ ...base, ...changes } as SyncOperation)
            ),
          /Invalid|Unsupported|requires|must|only|cannot|Value/
        )
      for (const cursor of [-1, 0.5])
        await assert.rejects(() => listChanges(f.database, f.householdId, cursor), /Invalid cursor/)
      for (const limit of [0, 501, 0.5])
        await assert.rejects(
          () => listChanges(f.database, f.householdId, 0, limit),
          /Invalid page size/
        )
      assert.lengthOf(await f.database('sync_receipts'), 0)
    } finally {
      await f.database.destroy()
    }
  })
  test('missing or deleted conflict targets cannot be resurrected and server choice closes them', async ({
    assert,
  }) => {
    const f = await fixture()
    try {
      const operation = { ...createOperation(), action: 'update' as const, baseRevision: 1 }
      const missing = await pushOperation(f.database, f.householdId, f.deviceId, operation)
      assert.isNull(missing.serverValue)
      await assert.rejects(
        () =>
          resolveConflict(f.database, f.householdId, f.deviceId, missing.conflictId!, 'proposed'),
        /no longer exists/
      )
      await resolveConflict(f.database, f.householdId, f.deviceId, missing.conflictId!, 'server')
      assert.deepEqual(
        await resolveConflict(f.database, f.householdId, f.deviceId, missing.conflictId!, 'server'),
        { id: missing.conflictId, choice: 'server', status: 'resolved' }
      )
      const created = createOperation()
      await pushOperation(f.database, f.householdId, f.deviceId, created)
      await pushOperation(f.database, f.householdId, f.deviceId, {
        ...created,
        operationId: randomUUID(),
        action: 'delete',
        baseRevision: 1,
        value: undefined,
      })
      const conflict = await pushOperation(f.database, f.householdId, f.deviceId, {
        ...created,
        operationId: randomUUID(),
        action: 'update',
        baseRevision: 2,
      })
      await assert.rejects(
        () =>
          resolveConflict(f.database, f.householdId, f.deviceId, conflict.conflictId!, 'proposed'),
        /deleted/
      )
      assert.lengthOf(await listConflicts(f.database, f.householdId), 1)
    } finally {
      await f.database.destroy()
    }
  })
  test('ledger deletion chosen during conflict review emits a tombstone', async ({ assert }) => {
    const f = await fixture()
    try {
      const op: SyncOperation = {
        ...createOperation(),
        entityType: 'ledger_entry',
        value: { kind: 'expense', entryDate: '2026-01-01', amountCents: 100 },
      }
      await pushOperation(f.database, f.householdId, f.deviceId, op)
      await pushOperation(f.database, f.householdId, f.deviceId, {
        ...op,
        operationId: randomUUID(),
        action: 'update',
        baseRevision: 1,
        value: { amountCents: 200 },
      })
      const conflict = await pushOperation(f.database, f.householdId, f.deviceId, {
        ...op,
        operationId: randomUUID(),
        action: 'delete',
        baseRevision: 1,
        value: undefined,
      })
      await resolveConflict(f.database, f.householdId, f.deviceId, conflict.conflictId!, 'proposed')
      const feed = await listChanges(f.database, f.householdId, 0)
      assert.isTrue(feed.changes.at(-1)!.deleted)
      assert.equal(feed.changes.at(-1)!.revision, 3)
    } finally {
      await f.database.destroy()
    }
  })
  test('change feed skips unknown event types and absent rows without losing cursor progress', async ({
    assert,
  }) => {
    const f = await fixture()
    try {
      for (const type of ['unsupported', 'category'])
        await f.database('change_events').insert({
          id: randomUUID(),
          household_id: f.householdId,
          entity_type: type,
          entity_id: randomUUID(),
          after_revision: 1,
        })
      const feed = await listChanges(f.database, f.householdId, 0)
      assert.lengthOf(feed.changes, 0)
      assert.equal(feed.nextCursor, 2)
      const empty = await listChanges(f.database, f.householdId, 2)
      assert.equal(empty.nextCursor, 2)
      assert.isFalse(empty.hasMore)
    } finally {
      await f.database.destroy()
    }
  })
  test('household settings reject an identity from another household', async ({ assert }) => {
    const f = await fixture()
    try {
      await assert.rejects(
        () =>
          pushOperation(f.database, f.householdId, f.deviceId, {
            ...createOperation(),
            entityType: 'household',
            action: 'update',
            baseRevision: 1,
            value: { reminderTime: '09:00' },
          }),
        /Invalid household ID/
      )
    } finally {
      await f.database.destroy()
    }
  })
})
