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
import { balancesAsOf } from '../../app/services/ledger.js'

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

test.group('sync write atomicity', () => {
  test('rolls back the accepted entity and change event if its receipt cannot be written', async ({
    assert,
  }) => {
    const f = await fixture()
    try {
      await f.database.raw(
        "create trigger fail_receipt before insert on sync_receipts begin select raise(abort, 'receipt failed'); end"
      )
      await assert.rejects(
        () => pushOperation(f.database, f.householdId, f.deviceId, createOperation()),
        /receipt failed/
      )
      assert.lengthOf(await f.database('categories'), 0)
      assert.lengthOf(await f.database('change_events'), 0)
    } finally {
      await f.database.destroy()
    }
  })

  test('rolls back a stale conflict if its receipt cannot be written', async ({ assert }) => {
    const f = await fixture()
    try {
      const created = createOperation()
      await pushOperation(f.database, f.householdId, f.deviceId, created)
      await f.database.raw(
        "create trigger fail_receipt before insert on sync_receipts begin select raise(abort, 'receipt failed'); end"
      )
      const stale: SyncOperation = {
        ...created,
        operationId: randomUUID(),
        action: 'update',
        baseRevision: 2,
        value: { name: 'Other' },
      }
      await assert.rejects(
        () => pushOperation(f.database, f.householdId, f.deviceId, stale),
        /receipt failed/
      )
      assert.lengthOf(await f.database('sync_conflicts'), 0)
    } finally {
      await f.database.destroy()
    }
  })

  test('rejects an operation ID reused by another device without writing that device’s entity', async ({
    assert,
  }) => {
    const f = await fixture()
    try {
      const first = createOperation('Food')
      await pushOperation(f.database, f.householdId, f.deviceId, first)
      const second = { ...createOperation('Transport'), operationId: first.operationId }
      await assert.rejects(
        () => pushOperation(f.database, f.householdId, f.otherDeviceId, second),
        /another device/
      )
      assert.lengthOf(await f.database('categories'), 1)
      assert.lengthOf(await f.database('change_events'), 1)
    } finally {
      await f.database.destroy()
    }
  })

  test('stores one stale conflict and returns the same outcome on retry', async ({ assert }) => {
    const f = await fixture()
    try {
      const created = createOperation()
      await pushOperation(f.database, f.householdId, f.deviceId, created)
      const stale: SyncOperation = {
        ...created,
        operationId: randomUUID(),
        action: 'update',
        baseRevision: 2,
        value: { name: 'Other' },
      }
      const first = await pushOperation(f.database, f.householdId, f.deviceId, stale)
      const retry = await pushOperation(f.database, f.householdId, f.deviceId, stale)
      assert.equal(first.status, 'conflict')
      assert.equal(retry.conflictId, first.conflictId)
      assert.equal(retry.status, 'conflict')
      assert.deepEqual(retry.proposedValue, stale)
      assert.lengthOf(await f.database('sync_conflicts'), 1)
      assert.lengthOf(await f.database('sync_receipts'), 2)
    } finally {
      await f.database.destroy()
    }
  })

  test('paginates a household change feed and includes deletion tombstones', async ({ assert }) => {
    const f = await fixture()
    try {
      const one = createOperation('Food')
      const two = createOperation('Transport')
      const three = createOperation('Home')
      await pushOperation(f.database, f.householdId, f.deviceId, one)
      await pushOperation(f.database, f.householdId, f.deviceId, two)
      await pushOperation(f.database, f.householdId, f.deviceId, three)
      const first = await listChanges(f.database, f.householdId, 0, 2)
      assert.lengthOf(first.changes, 2)
      assert.isTrue(first.hasMore)
      const second = await listChanges(f.database, f.householdId, first.nextCursor, 2)
      assert.lengthOf(second.changes, 1)
      assert.isFalse(second.hasMore)
      const deletion: SyncOperation = {
        operationId: randomUUID(),
        entityType: 'category',
        entityId: three.entityId,
        action: 'delete',
        baseRevision: 1,
      }
      await pushOperation(f.database, f.householdId, f.deviceId, deletion)
      const after = await listChanges(f.database, f.householdId, second.nextCursor, 2)
      assert.deepEqual(
        after.changes.map((change) => ({
          entityId: change.entityId,
          deleted: change.deleted,
          value: change.value,
        })),
        [{ entityId: three.entityId, deleted: true, value: null }]
      )
      await assert.rejects(() => listChanges(f.database, f.householdId, 0, 0), /Invalid page size/)
    } finally {
      await f.database.destroy()
    }
  })

  test('ledger create, update and delete sync operations recalculate balances', async ({
    assert,
  }) => {
    const f = await fixture()
    try {
      const created: SyncOperation = {
        operationId: randomUUID(),
        entityType: 'ledger_entry',
        entityId: randomUUID(),
        action: 'create',
        baseRevision: 0,
        value: { kind: 'expense', entryDate: '2026-02-01', amountCents: 2500 },
      }
      assert.equal(
        await pushOperation(f.database, f.householdId, f.deviceId, created).then(
          (result) => result.status
        ),
        'accepted'
      )
      assert.equal(
        await balancesAsOf(f.database, f.householdId, '2026-02-01').then(
          (result) => result.spendableCents
        ),
        97500
      )
      const changed: SyncOperation = {
        ...created,
        operationId: randomUUID(),
        action: 'update',
        baseRevision: 1,
        value: { amountCents: 3500 },
      }
      assert.equal(
        await pushOperation(f.database, f.householdId, f.deviceId, changed).then(
          (result) => result.revision
        ),
        2
      )
      assert.equal(
        await balancesAsOf(f.database, f.householdId, '2026-02-01').then(
          (result) => result.spendableCents
        ),
        96500
      )
      const deleted: SyncOperation = {
        ...created,
        operationId: randomUUID(),
        action: 'delete',
        baseRevision: 2,
      }
      assert.equal(
        await pushOperation(f.database, f.householdId, f.deviceId, deleted).then(
          (result) => result.revision
        ),
        3
      )
      assert.equal(
        await balancesAsOf(f.database, f.householdId, '2026-02-01').then(
          (result) => result.spendableCents
        ),
        100000
      )
    } finally {
      await f.database.destroy()
    }
  })

  test('invalid ledger operation is rejected without a receipt or change event', async ({
    assert,
  }) => {
    const f = await fixture()
    try {
      const invalid: SyncOperation = {
        operationId: randomUUID(),
        entityType: 'ledger_entry',
        entityId: randomUUID(),
        action: 'create',
        baseRevision: 0,
        value: { kind: 'expense', entryDate: '2026-02-01', amountCents: 1.5 },
      }
      await assert.rejects(
        () => pushOperation(f.database, f.householdId, f.deviceId, invalid),
        /safe integer/
      )
      assert.lengthOf(await f.database('ledger_entries'), 0)
      assert.lengthOf(await f.database('change_events'), 0)
      assert.lengthOf(await f.database('sync_receipts'), 0)
    } finally {
      await f.database.destroy()
    }
  })

  test('recurring rules use validated sync mutations and publish revisions', async ({ assert }) => {
    const f = await fixture()
    try {
      const created: SyncOperation = {
        operationId: randomUUID(),
        entityType: 'recurring_rule',
        entityId: randomUUID(),
        action: 'create',
        baseRevision: 0,
        value: {
          kind: 'bill',
          name: 'Internet',
          categoryId: null,
          amountCents: 6500,
          frequency: 'monthly',
          interval: 1,
          startsOn: '2026-10-15',
          endsOn: null,
        },
      }
      assert.equal(
        await pushOperation(f.database, f.householdId, f.deviceId, created).then(
          (result) => result.revision
        ),
        1
      )
      const updated: SyncOperation = {
        ...created,
        operationId: randomUUID(),
        action: 'update',
        baseRevision: 1,
        value: { amountCents: 7000 },
      }
      assert.equal(
        await pushOperation(f.database, f.householdId, f.deviceId, updated).then(
          (result) => result.revision
        ),
        2
      )
      const deleted: SyncOperation = {
        ...created,
        operationId: randomUUID(),
        action: 'delete',
        baseRevision: 2,
      }
      assert.equal(
        await pushOperation(f.database, f.householdId, f.deviceId, deleted).then(
          (result) => result.revision
        ),
        3
      )
      const events = await f
        .database('change_events')
        .where({ entity_type: 'recurring_rule', entity_id: created.entityId })
      assert.deepEqual(
        events.map((event) => event.after_revision),
        [1, 2, 3]
      )
      const { changes } = await listChanges(f.database, f.householdId, 0)
      assert.lengthOf(
        changes.filter((change) => change.entityType === 'recurring_rule'),
        3
      )
      assert.isTrue(changes.some((change) => change.entityType === 'occurrence' && change.deleted))
    } finally {
      await f.database.destroy()
    }
  })

  test('change feed returns tombstones for physically removed generated occurrences', async ({
    assert,
  }) => {
    const f = await fixture()
    try {
      const occurrenceId = randomUUID()
      await f.database('change_events').insert({
        id: randomUUID(),
        household_id: f.householdId,
        device_id: null,
        entity_type: 'occurrence',
        entity_id: occurrenceId,
        before_revision: 1,
        after_revision: null,
        operation_id: null,
        created_at: new Date().toISOString(),
      })
      const page = await listChanges(f.database, f.householdId, 0)
      assert.deepEqual(
        page.changes.map((change) => ({
          entityId: change.entityId,
          deleted: change.deleted,
          value: change.value,
        })),
        [{ entityId: occurrenceId, deleted: true, value: null }]
      )
    } finally {
      await f.database.destroy()
    }
  })
})

test.group('sync recovery', () => {
  test('refreshes the server candidate and applies only the reviewed revision once', async ({
    assert,
  }) => {
    const f = await fixture()
    try {
      const created = createOperation()
      await pushOperation(f.database, f.householdId, f.deviceId, created)
      const stale: SyncOperation = {
        ...created,
        operationId: randomUUID(),
        action: 'update',
        baseRevision: 2,
        value: { name: 'Local' },
      }
      const conflict = await pushOperation(f.database, f.householdId, f.deviceId, stale)
      await pushOperation(f.database, f.householdId, f.otherDeviceId, {
        ...stale,
        operationId: randomUUID(),
        baseRevision: 1,
        value: { name: 'New server' },
      })
      const candidates = await listConflicts(f.database, f.householdId)
      assert.equal(candidates[0].serverValue?.revision, 2)
      assert.propertyVal(candidates[0].serverValue!, 'name', 'New server')
      await assert.rejects(
        () =>
          resolveConflict(
            f.database,
            f.householdId,
            f.deviceId,
            conflict.conflictId!,
            'proposed',
            1
          ),
        /changed since/
      )
      const result = await resolveConflict(
        f.database,
        f.householdId,
        f.deviceId,
        conflict.conflictId!,
        'proposed',
        2
      )
      assert.deepEqual(
        await resolveConflict(
          f.database,
          f.householdId,
          f.otherDeviceId,
          conflict.conflictId!,
          'server',
          2
        ),
        result
      )
      const current = await f.database('categories').where({ id: created.entityId }).first()
      assert.equal(current.name, 'Local')
      assert.equal(current.revision, 3)
      assert.lengthOf(await listConflicts(f.database, f.householdId), 0)
    } finally {
      await f.database.destroy()
    }
  })

  test('removed occurrences produce an empty page that still advances', async ({ assert }) => {
    const f = await fixture()
    try {
      await f.database('change_events').insert(
        Array.from({ length: 101 }, () => ({
          id: randomUUID(),
          household_id: f.householdId,
          entity_type: 'occurrence',
          entity_id: randomUUID(),
          after_revision: 1,
        }))
      )
      const page = await listChanges(f.database, f.householdId, 0, 100)
      assert.lengthOf(page.changes, 0)
      assert.equal(page.nextCursor, 100)
      assert.isTrue(page.hasMore)
    } finally {
      await f.database.destroy()
    }
  })
})
