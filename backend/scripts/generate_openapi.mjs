import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const ref = (name) => ({ $ref: `#/components/schemas/${name}` })
const object = (properties, required = Object.keys(properties)) => ({ type: 'object', additionalProperties: false, properties, required })
const string = (format, example) => ({ type: 'string', ...(format ? { format } : {}), ...(example === undefined ? {} : { example }) })
const integer = (minimum, example) => ({ type: 'integer', minimum, ...(example === undefined ? {} : { example }) })
const cents = { type: 'integer', description: 'CAD cents. Signed where the operation permits corrections or transfers.', example: 12500 }
const uuid = string('uuid', '11111111-1111-4111-8111-111111111111')
const date = string('date', '2026-10-01')
const month = { type: 'string', pattern: '^\\d{4}-(0[1-9]|1[0-2])$', example: '2026-10' }
const instant = string('date-time', '2026-10-01T13:00:00.000Z')
const nullable = (schema) => ({ anyOf: [schema, { type: 'null' }] })
const enumeration = (...values) => ({ type: 'string', enum: values })
const array = (items) => ({ type: 'array', items })
const data = (schema) => object({ data: schema })
const schemas = {
  Error: object({ code: string(undefined, 'VALIDATION_ERROR'), message: string(undefined, 'Invalid request'), details: nullable(array(object({ field: string(), message: string(), rule: string(), meta: { type: 'object', additionalProperties: true } }, ['field', 'message', 'rule']))) }, ['code']),
  Household: object({ id: uuid, currency: { const: 'CAD' }, timeZone: string(undefined, 'America/Toronto'), reminderTime: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', example: '09:00' }, openingSpendableCents: cents, openingSavingsCents: cents, openingDate: date, monthlySavingsTargetCents: nullable(cents), revision: integer(1, 1) }),
  Device: object({ id: uuid, label: string(undefined, 'Kitchen phone'), pairedAt: instant, revokedAt: nullable(instant) }),
  Category: object({ id: uuid, name: string(undefined, 'Food'), active: { type: 'boolean' }, revision: integer(1, 1), deletedAt: nullable(instant) }),
  LedgerEntry: object({ id: uuid, kind: enumeration('income', 'expense', 'category_adjustment', 'savings_transfer', 'balance_adjustment'), entryDate: date, amountCents: cents, categoryId: nullable(uuid), account: nullable(enumeration('spendable', 'savings')), note: nullable(string()), occurrenceId: nullable(uuid), revision: integer(1, 1), deletedAt: nullable(instant) }),
  Balances: object({ spendableCents: cents, savingsCents: cents, combinedCents: cents }),
  Actuals: object({ incomeCents: cents, spendingCents: cents, transferToSavingsCents: cents, moneyLeftTodayCents: cents }),
  Estimate: object({ id: uuid, categoryId: uuid, month, amountCents: cents, revision: integer(1, 1), deletedAt: nullable(instant) }, ['id', 'categoryId', 'month', 'amountCents', 'revision']),
  SavingsTarget: object({ id: uuid, month, amountCents: nullable(cents), revision: integer(1, 1) }),
  Plan: object({ month, openingSpendableCents: cents, expectedIncomeCents: cents, expectedBillsCents: cents, estimateCents: cents, savingsTargetCents: cents, moneyLeftCents: cents, estimates: array(ref('Estimate')), savingsTarget: nullable(ref('SavingsTarget')) }),
  Suggestion: object({ categoryId: uuid, month, amountCents: nullable(cents), sampleCount: integer(0, 5) }),
  RecurringRule: object({ id: uuid, kind: enumeration('income', 'bill', 'subscription'), name: string(undefined, 'Internet'), categoryId: nullable(uuid), amountCents: cents, frequency: enumeration('daily', 'weekly', 'biweekly', 'twice_monthly', 'monthly', 'yearly'), interval: integer(1, 1), startsOn: date, endsOn: nullable(date), scheduleDetails: nullable(object({ days: array(integer(1)) }, ['days'])), active: { type: 'boolean' }, revision: integer(1, 1) }, ['id', 'kind', 'name', 'amountCents', 'frequency', 'interval', 'startsOn', 'revision']),
  Occurrence: object({ id: uuid, ruleId: uuid, ruleName: string(), ruleKind: enumeration('income', 'bill', 'subscription'), expectedDate: date, expectedAmountCents: cents, status: enumeration('expected', 'confirmed'), displayStatus: enumeration('upcoming', 'due', 'overdue', 'confirmed'), actualDate: nullable(date), actualAmountCents: nullable(cents), confirmationMethod: nullable(enumeration('manual', 'automatic')), needsReview: { type: 'boolean' }, revision: integer(1, 1) }, ['id', 'ruleId', 'ruleName', 'ruleKind', 'expectedDate', 'expectedAmountCents', 'status', 'displayStatus', 'needsReview', 'revision']),
  ChangeEvent: object({ id: uuid, deviceId: nullable(uuid), deviceLabel: nullable(string()), beforeRevision: nullable(integer(0)), afterRevision: integer(1), createdAt: instant, before: nullable(ref('LedgerEntry')), after: nullable(ref('LedgerEntry')) }),
  SyncOperation: object({ operationId: uuid, entityId: uuid, entityType: enumeration('category', 'ledger_entry', 'recurring_rule', 'occurrence', 'monthly_estimate', 'monthly_plan', 'household'), action: enumeration('create', 'update', 'delete'), baseRevision: integer(0), value: nullable(ref('SyncOperationValue')) }, ['operationId', 'entityId', 'entityType', 'action', 'baseRevision']),
  SyncOutcome: object({ operationId: nullable(string()), status: enumeration('accepted', 'duplicate', 'conflict', 'rejected'), entityId: uuid, revision: nullable(integer(1)), conflictId: nullable(uuid), serverValue: nullable(ref('SyncSnapshot')), proposedValue: ref('SyncOperation'), code: string(), details: nullable(array(object({ field: string(), message: string(), rule: string(), meta: { type: 'object', additionalProperties: true } }, ['field', 'message', 'rule']))), message: string() }, ['operationId', 'status']),
  SyncChange: object({ cursor: integer(0), entityType: enumeration('category', 'ledger_entry', 'recurring_rule', 'occurrence', 'monthly_estimate', 'monthly_plan', 'household'), entityId: uuid, revision: nullable(integer(1)), deleted: { type: 'boolean' }, value: nullable(ref('SyncFeedValue')) }),
  SyncConflict: object({ id: uuid, entityType: enumeration('category', 'ledger_entry', 'recurring_rule', 'occurrence', 'monthly_estimate', 'monthly_plan', 'household'), entityId: uuid, serverValue: nullable(ref('SyncSnapshot')), proposedValue: ref('SyncOperation'), createdAt: instant }),
  ApkMetadata: object({ versionName: string(undefined, '1.2.0'), versionCode: integer(1, 12), sha256: { type: 'string', pattern: '^[0-9a-f]{64}$' }, signature: string(undefined, 'base64-ed25519-signature') }),
  BootstrapRequest: object({ openingSpendableCents: cents, openingSavingsCents: cents, reminderTime: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', example: '09:00' } }),
  PairRequest: object({ pairingCode: string(undefined, '<one-time code from existing phone>'), label: string(undefined, 'Kitchen phone') }),
  DeviceRename: object({ label: string(undefined, 'Kitchen phone') }),
  ReminderUpdate: object({ reminderTime: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', example: '09:00' }, revision: integer(1, 1) }),
  RevisionOnly: object({ revision: integer(1, 1) }),
  RuleDelete: object({ from: date, through: date, revision: integer(1, 1) }),
  CategoryCreate: object({ name: string(undefined, 'Food') }),
  CategoryUpdate: object({ name: string(), active: { type: 'boolean' }, revision: integer(1, 1) }, ['revision']),
  EntryCreate: object({ kind: enumeration('income', 'expense', 'category_adjustment', 'savings_transfer', 'balance_adjustment'), entryDate: date, amountCents: cents, categoryId: nullable(uuid), account: nullable(enumeration('spendable', 'savings')), note: nullable(string()) }, ['kind', 'entryDate', 'amountCents']),
  EntryUpdate: object({ kind: enumeration('income', 'expense', 'category_adjustment', 'savings_transfer', 'balance_adjustment'), entryDate: date, amountCents: cents, categoryId: nullable(uuid), account: nullable(enumeration('spendable', 'savings')), note: nullable(string()), revision: integer(1, 1) }, ['revision']),
  EstimatePut: object({ amountCents: integer(0, 35000), revision: integer(0, 0), id: uuid, operationId: uuid }, ['amountCents', 'revision']),
  SavingsTargetPut: object({ amountCents: nullable(integer(0, 5000)), revision: integer(0, 0), id: uuid, operationId: uuid }, ['amountCents', 'revision']),
  RecurringCreate: object({ kind: enumeration('income', 'bill', 'subscription'), name: string(undefined, 'Internet'), categoryId: nullable(uuid), amountCents: integer(1, 6500), frequency: enumeration('daily', 'weekly', 'biweekly', 'twice_monthly', 'monthly', 'yearly'), interval: integer(1, 1), startsOn: date, endsOn: nullable(date), scheduleDetails: nullable(object({ days: array(integer(1)) }, ['days'])) }, ['kind', 'name', 'amountCents', 'frequency', 'interval', 'startsOn']),
  RecurringUpdate: object({ kind: enumeration('income', 'bill', 'subscription'), name: string(), amountCents: integer(1), frequency: enumeration('daily', 'weekly', 'biweekly', 'twice_monthly', 'monthly', 'yearly'), interval: integer(1), startsOn: date, endsOn: nullable(date), scheduleDetails: nullable(object({ days: array(integer(1)) }, ['days'])), from: date, through: date, revision: integer(1, 1) }, ['from', 'through', 'revision']),
  Confirmation: object({ actualDate: date, actualAmountCents: integer(0, 6500), revision: integer(1, 1) }, ['revision']),
  SyncPush: object({ generation: uuid, operations: { type: 'array', minItems: 1, maxItems: 100, items: ref('SyncOperation') } }, ['operations']),
  ConflictResolution: object({ generation: uuid, choice: enumeration('server', 'proposed'), serverRevision: nullable(integer(1)) }, ['choice']),
}

const syncValues = {
  CategoryValue: object({ name: string(), active: { type: 'boolean' } }, ['name']),
  EntryValue: object({ kind: schemas.LedgerEntry.properties.kind, entryDate: date, amountCents: cents, categoryId: nullable(uuid), account: nullable(schemas.LedgerEntry.properties.account.anyOf[0]), note: nullable(string()), occurrenceId: nullable(uuid) }, ['kind', 'entryDate', 'amountCents']),
  RuleValue: object({ kind: schemas.RecurringRule.properties.kind, name: string(), categoryId: nullable(uuid), amountCents: cents, frequency: schemas.RecurringRule.properties.frequency, interval: integer(1), startsOn: date, endsOn: nullable(date), scheduleDetails: nullable(schemas.RecurringRule.properties.scheduleDetails.anyOf[0]), active: { type: 'boolean' } }, ['kind', 'name', 'amountCents', 'frequency', 'interval', 'startsOn']),
  OccurrenceValue: object({ ruleName: string(), ruleKind: enumeration('income', 'bill', 'subscription'), ruleId: uuid, expectedDate: date, expectedAmountCents: cents, status: enumeration('expected', 'confirmed'), actualDate: nullable(date), actualAmountCents: nullable(cents), confirmationMethod: nullable(enumeration('manual', 'automatic')), needsReview: { type: 'boolean' } }, ['ruleId', 'expectedDate', 'expectedAmountCents', 'status']),
  EstimateValue: object({ categoryId: uuid, month, amountCents: cents }),
  MonthlyPlanValue: object({ month, savingsTargetCents: nullable(cents) }),
  HouseholdValue: schemas.Household,
}
Object.assign(schemas, syncValues)
const valueNames = Object.keys(syncValues)
schemas.SyncFeedValue = { anyOf: valueNames.map(ref) }
schemas.SyncOperationValue = { description: 'Entity-specific create/update fields. For update, only changed fields may be supplied. Validation is selected by entityType and action.', anyOf: valueNames.map((name) => ({ ...syncValues[name], required: [] })) }
schemas.SyncSnapshot = { anyOf: valueNames.map((name) => object({ id: uuid, revision: integer(1), deletedAt: nullable(instant), ...syncValues[name].properties }, [...new Set(['id', 'revision', 'deletedAt', ...syncValues[name].required])])) }

const param = (name, where, schema, required = true) => ({ name, in: where, required, schema })
const path = (name, schema = uuid) => param(name, 'path', schema)
const query = (name, schema, required = true) => param(name, 'query', schema, required)
const json = (schema, example) => ({ content: { 'application/json': { schema, ...(example === undefined ? {} : { example }) } } })
const requestExamples = {
  BootstrapRequest: { openingSpendableCents: 100000, openingSavingsCents: 50000, reminderTime: '09:00' },
  PairRequest: { pairingCode: '<one-time code from a household phone>', label: 'Kitchen phone' },
  CategoryCreate: { name: 'Food' },
  EntryCreate: { kind: 'expense', entryDate: '2026-10-01', amountCents: 1250, categoryId: '33333333-3333-4333-8333-333333333333', note: 'Lunch' },
  EstimatePut: { amountCents: 35000, revision: 0 },
  RecurringCreate: { kind: 'bill', name: 'Internet', amountCents: 6500, frequency: 'monthly', interval: 1, startsOn: '2026-10-01' },
  SyncPush: { operations: [{ operationId: '55555555-5555-4555-8555-555555555555', entityId: '66666666-6666-4666-8666-666666666666', entityType: 'category', action: 'create', baseRevision: 0, value: { name: 'Transport' } }] },
  ConflictResolution: { choice: 'server' },
}
const routeExamples = {
  '/api/v1/months/{month}/plan': { data: { month: '2026-10', openingSpendableCents: 100000, expectedIncomeCents: 250000, expectedBillsCents: 50000, estimateCents: 35000, savingsTargetCents: 10000, moneyLeftCents: 255000, estimates: [], savingsTarget: null } },
  '/api/v1/sync/push': { data: { outcomes: [{ operationId: '55555555-5555-4555-8555-555555555555', status: 'accepted', revision: 1 }] } },
  '/api/v1/sync/conflicts': { data: { conflicts: [{ id: '88888888-8888-4888-8888-888888888888', entityType: 'category', entityId: '66666666-6666-4666-8666-666666666666', serverValue: { id: '66666666-6666-4666-8666-666666666666', revision: 2, deletedAt: null, name: 'Bus', active: true }, proposedValue: requestExamples.SyncPush.operations[0], createdAt: '2026-10-01T13:00:00.000Z' }] } },
  '/install/version.json': { versionName: '1.2.0', versionCode: 12, sha256: 'a'.repeat(64), signature: '<base64 Ed25519 signature>' },
}
const response = (schema, description = 'Success', example) => ({ description, ...json(schema, example) })
const errors = (codes) => Object.fromEntries(codes.map((code) => [String(code), response(ref('Error'), ({ 400: 'Invalid request', 401: 'Device credential missing, invalid, or revoked', 403: 'Forbidden', 404: 'Not found', 409: 'State or revision conflict', 422: 'Field validation failed', 500: 'Server error' })[code])]))
const spec = {
  openapi: '3.1.0',
  info: { title: 'Household Budget', version: '1.0.0', description: 'Private Android household API. CAD cents, home time zone calendar dates, and per-device Bearer credentials.' },
  servers: [{ url: 'https://budget.home.arpa', description: 'Home Wi-Fi server' }, { url: 'http://localhost:3333', description: 'Local development' }],
  security: [{ deviceBearer: [] }],
  tags: ['Access', 'Ledger', 'Planning', 'Recurring', 'Sync', 'Distribution', 'Documentation'].map((name) => ({ name })),
  components: { securitySchemes: { deviceBearer: { type: 'http', scheme: 'bearer', bearerFormat: 'opaque per-device credential' } }, schemas },
  paths: {},
}

function add(method, route, summary, options = {}) {
  const { tag = 'Access', description = '', security = true, loopback = false, parameters = [], body, result = data(object({})), status = 200, errors: errorCodes = [400, 401, 404, 409, 422, 500], example, media = 'application/json' } = options
  const operation = {
    tags: [tag], operationId: `${method}_${route}`.replace(/[^a-zA-Z0-9]+/g, '_'), summary, description,
    ...(security ? {} : { security: [] }), ...(loopback ? { 'x-access': 'loopback-only' } : {}),
    ...(parameters.length ? { parameters } : {}), ...(body ? { requestBody: { required: true, ...json(ref(body), requestExamples[body]) } } : {}),
    responses: { [status]: status === 204 ? { description: 'No content' } : { description: 'Success', content: { [media]: { schema: result, ...((example ?? routeExamples[route]) === undefined ? {} : { example: example ?? routeExamples[route] }) } } }, ...errors(errorCodes) },
  }
  spec.paths[route] ??= {}
  spec.paths[route][method.toLowerCase()] = operation
}

add('GET', '/api/v1/health', 'Health status', { security: false, result: data(object({ status: { const: 'ok' } })), example: { data: { status: 'ok' } }, errors: [500] })
add('POST', '/api/v1/bootstrap', 'Initialize the only household', { security: false, loopback: true, body: 'BootstrapRequest', status: 201, result: data(object({ household: ref('Household'), pairingCode: string(), expiresInSeconds: integer(1) })), errors: [403, 409, 422, 500], example: { data: { household: { id: '11111111-1111-4111-8111-111111111111', currency: 'CAD', timeZone: 'America/Toronto' }, pairingCode: '<one-time code>', expiresInSeconds: 300 } } })
add('POST', '/api/v1/pair', 'Pair one Android phone', { security: false, body: 'PairRequest', status: 201, result: data(object({ deviceId: uuid, householdId: uuid, credential: string() })), errors: [410, 422, 500], example: { data: { deviceId: '22222222-2222-4222-8222-222222222222', householdId: '11111111-1111-4111-8111-111111111111', credential: '<per-device secret shown once>' } } })
add('GET', '/api/v1/household', 'Household settings and opening balances', { result: data(ref('Household')) })
add('PATCH', '/api/v1/household', 'Change the shared reminder hour', { body: 'ReminderUpdate', result: data(ref('Household')), description: 'Requires the current household revision; accepted changes appear in the offline change feed.' })
add('GET', '/api/v1/devices', 'List paired phones', { result: data(array(ref('Device'))) })
add('PATCH', '/api/v1/devices/{id}', 'Rename a paired phone', { parameters: [path('id')], body: 'DeviceRename', result: data(ref('Device')) })
add('DELETE', '/api/v1/devices/{id}', 'Revoke a paired phone', { parameters: [path('id')], status: 204 })
add('POST', '/api/v1/pairing-codes', 'Create a short-lived pairing QR payload', { status: 201, result: data(object({ pairingCode: string(), pairingUri: string('uri'), expiresInSeconds: integer(1) })) })
add('DELETE', '/api/v1/pairing-codes', 'Invalidate unused pairing codes', { status: 204 })
add('GET', '/api/v1/categories', 'List active categories', { tag: 'Ledger', result: data(array(ref('Category'))) })
add('POST', '/api/v1/categories', 'Create a category', { tag: 'Ledger', body: 'CategoryCreate', status: 201, result: data(ref('Category')), example: { data: { id: '33333333-3333-4333-8333-333333333333', name: 'Food', active: true, revision: 1, deletedAt: null } } })
add('PATCH', '/api/v1/categories/{id}', 'Edit a category', { tag: 'Ledger', parameters: [path('id')], body: 'CategoryUpdate', result: data(ref('Category')) })
add('DELETE', '/api/v1/categories/{id}', 'Soft-delete a category', { tag: 'Ledger', parameters: [path('id')], body: 'RevisionOnly', status: 204 })
add('GET', '/api/v1/entries', 'List ledger entries', { tag: 'Ledger', parameters: [query('month', month, false)], result: data(array(ref('LedgerEntry'))) })
add('POST', '/api/v1/entries', 'Record a manual entry', { tag: 'Ledger', body: 'EntryCreate', status: 201, result: data(ref('LedgerEntry')), example: { data: { id: '44444444-4444-4444-8444-444444444444', kind: 'expense', entryDate: '2026-10-01', amountCents: 1250, categoryId: '33333333-3333-4333-8333-333333333333', account: null, note: 'Lunch', occurrenceId: null, revision: 1, deletedAt: null } } })
add('GET', '/api/v1/entries/{id}', 'Read a ledger entry', { tag: 'Ledger', parameters: [path('id')], result: data(ref('LedgerEntry')) })
add('PATCH', '/api/v1/entries/{id}', 'Correct a manual entry', { tag: 'Ledger', parameters: [path('id')], body: 'EntryUpdate', result: data(ref('LedgerEntry')) })
add('DELETE', '/api/v1/entries/{id}', 'Soft-delete a manual entry', { tag: 'Ledger', parameters: [path('id')], body: 'RevisionOnly', status: 204 })
add('GET', '/api/v1/entries/{id}/history', 'Entry revision history', { tag: 'Ledger', parameters: [path('id')], result: data(array(ref('ChangeEvent'))) })
add('GET', '/api/v1/balances', 'Spendable, savings, and combined actual balances', { tag: 'Ledger', parameters: [query('asOf', date)], result: data(ref('Balances')), example: { data: { spendableCents: 125000, savingsCents: 40000, combinedCents: 165000 } } })
add('GET', '/api/v1/months/{month}/actuals', 'Actual month activity through today', { tag: 'Ledger', parameters: [path('month', month), query('today', date)], result: data(ref('Actuals')) })
add('PUT', '/api/v1/months/{month}/estimates/{categoryId}', 'Set a monthly category estimate', { tag: 'Planning', parameters: [path('month', month), path('categoryId')], body: 'EstimatePut', result: data(ref('Estimate')) })
add('PUT', '/api/v1/months/{month}/savings-target', 'Set an optional savings target', { tag: 'Planning', parameters: [path('month', month)], body: 'SavingsTargetPut', result: data(ref('SavingsTarget')) })
add('GET', '/api/v1/months/{month}/plan', 'Planned spendable money left', { tag: 'Planning', parameters: [path('month', month)], result: data(ref('Plan')), description: 'Opening spendable balance plus expected recurring income, less expected bills, accepted category estimates, and optional savings target. Actual entries do not replace expected values.' })
add('GET', '/api/v1/months/{month}/suggestions/{categoryId}', 'Five-month median spending suggestion', { tag: 'Planning', parameters: [path('month', month), path('categoryId')], result: data(ref('Suggestion')), description: 'Ignores months with no spending and never overwrites an accepted estimate. Apply explicitly with PUT /estimates.' })
add('GET', '/api/v1/recurring-rules', 'List recurring rules with IDs and revisions', { tag: 'Recurring', result: data(array(ref('RecurringRule'))) })
add('GET', '/api/v1/recurring-rules/{id}', 'Read a recurring rule', { tag: 'Recurring', parameters: [path('id')], result: data(ref('RecurringRule')) })
add('POST', '/api/v1/recurring-rules', 'Create repeating income, bill, or subscription', { tag: 'Recurring', body: 'RecurringCreate', status: 201, result: data(ref('RecurringRule')), example: { data: { id: '77777777-7777-4777-8777-777777777777', kind: 'bill', name: 'Internet', categoryId: null, amountCents: 6500, frequency: 'monthly', interval: 1, startsOn: '2026-10-01', endsOn: null, scheduleDetails: null, active: true, revision: 1 } } })
add('PATCH', '/api/v1/recurring-rules/{id}', 'Edit future schedule while preserving confirmed history', { tag: 'Recurring', parameters: [path('id')], body: 'RecurringUpdate', result: data(ref('RecurringRule')) })
add('DELETE', '/api/v1/recurring-rules/{id}', 'Stop future occurrences', { tag: 'Recurring', parameters: [path('id')], body: 'RuleDelete', status: 204 })
add('GET', '/api/v1/occurrences', 'List generated expected and confirmed occurrences', { tag: 'Recurring', parameters: [query('from', date), query('through', date), query('today', date, false)], result: data(array(ref('Occurrence'))), description: 'Income remains overdue until manually confirmed. Bills and subscriptions auto-confirm two days after due date and set needsReview on the linked entry.' })
add('POST', '/api/v1/occurrences/{id}/confirm', 'Confirm or correct occurrence date and amount', { tag: 'Recurring', parameters: [path('id')], body: 'Confirmation', result: data(object({ ...schemas.Occurrence.properties, entry: object({ id: uuid, amountCents: cents, entryDate: date, revision: integer(1) }) })) })
add('POST', '/api/v1/sync/push', 'Push offline operations idempotently', { tag: 'Sync', body: 'SyncPush', result: data(object({ outcomes: array(ref('SyncOutcome')) })), description: '1–100 operations. Client-generated stable entity and operation UUIDs. Create uses baseRevision 0. Accepted retries return duplicate; conflicting retries retain conflict status. Unexpected storage failures return HTTP 500 and must be retried with the same operation IDs. Supply the generation from the change feed to reject a push after restore.' })
add('GET', '/api/v1/sync/changes', 'Pull one page of changes and tombstones', { tag: 'Sync', parameters: [query('cursor', { ...integer(0), default: 0 }, false), query('limit', { ...integer(1), maximum: 500, default: 100 }, false)], result: data(object({ changes: array(ref('SyncChange')), nextCursor: integer(0), hasMore: { type: 'boolean' }, generation: uuid })), description: 'Default 100, maximum 500 events per page. Advance cursor only after applying the entire page locally. Deleted entities carry deleted=true and value=null. Empty pages can still advance the cursor. A changed generation requires clearing accepted caches and replaying from cursor 0 before pushing preserved edits.' })
add('GET', '/api/v1/sync/conflicts', 'List unresolved concurrent edits', { tag: 'Sync', result: data(object({ conflicts: array(ref('SyncConflict')) })) })
add('POST', '/api/v1/sync/conflicts/{id}/resolve', 'Keep server or apply phone proposal', { tag: 'Sync', parameters: [path('id')], body: 'ConflictResolution', description: 'Supply the reviewed serverRevision when choosing proposed. Omission uses the original conflict revision for legacy clients. Repeated resolutions return the recorded choice. Conflicts absent from the open list have been resolved.', result: data(object({ id: uuid, choice: enumeration('server', 'proposed'), status: { const: 'resolved' } })) })
add('GET', '/install', 'Browsable Android installation page with download QR', { tag: 'Distribution', security: false, media: 'text/html', result: { type: 'string', contentMediaType: 'text/html' }, errors: [404, 500] })
add('GET', '/install/version.json', 'Signed APK version metadata', { tag: 'Distribution', security: false, result: ref('ApkMetadata'), errors: [404, 500], description: 'Unwrapped JSON because the Ed25519 signature covers the exact versionName/versionCode/sha256 metadata. Verify signature using the public key embedded in the Android app, then SHA-256 of downloaded APK.' })
add('GET', '/install/budget.apk', 'Download signed Android APK', { tag: 'Distribution', security: false, media: 'application/vnd.android.package-archive', result: { type: 'string', format: 'binary' }, errors: [404, 500] })
add('GET', '/docs', 'Browse API documentation locally', { tag: 'Documentation', security: false, media: 'text/html', result: { type: 'string', contentMediaType: 'text/html' }, errors: [500] })
add('GET', '/openapi/v1.json', 'Download versioned OpenAPI 3.1 document', { tag: 'Documentation', security: false, result: { type: 'object', additionalProperties: true }, errors: [500] })

const target = process.argv[2] || join(root, 'openapi/v1.json')
await mkdir(dirname(target), { recursive: true })
await writeFile(target, JSON.stringify(spec, null, 2) + '\n')
console.log(target)
