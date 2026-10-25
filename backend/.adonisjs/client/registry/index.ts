/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

const placeholder: any = {}

const routes = {
  'health.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/health',
    tokens: [{"old":"/api/v1/health","type":0,"val":"api","end":""},{"old":"/api/v1/health","type":0,"val":"v1","end":""},{"old":"/api/v1/health","type":0,"val":"health","end":""}],
    types: placeholder as Registry['health.show']['types'],
  },
  'households.bootstrap': {
    methods: ["POST"],
    pattern: '/api/v1/bootstrap',
    tokens: [{"old":"/api/v1/bootstrap","type":0,"val":"api","end":""},{"old":"/api/v1/bootstrap","type":0,"val":"v1","end":""},{"old":"/api/v1/bootstrap","type":0,"val":"bootstrap","end":""}],
    types: placeholder as Registry['households.bootstrap']['types'],
  },
  'pairing.pair': {
    methods: ["POST"],
    pattern: '/api/v1/pair',
    tokens: [{"old":"/api/v1/pair","type":0,"val":"api","end":""},{"old":"/api/v1/pair","type":0,"val":"v1","end":""},{"old":"/api/v1/pair","type":0,"val":"pair","end":""}],
    types: placeholder as Registry['pairing.pair']['types'],
  },
  'households.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/household',
    tokens: [{"old":"/api/v1/household","type":0,"val":"api","end":""},{"old":"/api/v1/household","type":0,"val":"v1","end":""},{"old":"/api/v1/household","type":0,"val":"household","end":""}],
    types: placeholder as Registry['households.show']['types'],
  },
  'households.update': {
    methods: ["PATCH"],
    pattern: '/api/v1/household',
    tokens: [{"old":"/api/v1/household","type":0,"val":"api","end":""},{"old":"/api/v1/household","type":0,"val":"v1","end":""},{"old":"/api/v1/household","type":0,"val":"household","end":""}],
    types: placeholder as Registry['households.update']['types'],
  },
  'devices.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/devices',
    tokens: [{"old":"/api/v1/devices","type":0,"val":"api","end":""},{"old":"/api/v1/devices","type":0,"val":"v1","end":""},{"old":"/api/v1/devices","type":0,"val":"devices","end":""}],
    types: placeholder as Registry['devices.index']['types'],
  },
  'devices.update': {
    methods: ["PATCH"],
    pattern: '/api/v1/devices/:id',
    tokens: [{"old":"/api/v1/devices/:id","type":0,"val":"api","end":""},{"old":"/api/v1/devices/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/devices/:id","type":0,"val":"devices","end":""},{"old":"/api/v1/devices/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['devices.update']['types'],
  },
  'devices.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/devices/:id',
    tokens: [{"old":"/api/v1/devices/:id","type":0,"val":"api","end":""},{"old":"/api/v1/devices/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/devices/:id","type":0,"val":"devices","end":""},{"old":"/api/v1/devices/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['devices.destroy']['types'],
  },
  'pairing.createCode': {
    methods: ["POST"],
    pattern: '/api/v1/pairing-codes',
    tokens: [{"old":"/api/v1/pairing-codes","type":0,"val":"api","end":""},{"old":"/api/v1/pairing-codes","type":0,"val":"v1","end":""},{"old":"/api/v1/pairing-codes","type":0,"val":"pairing-codes","end":""}],
    types: placeholder as Registry['pairing.createCode']['types'],
  },
  'pairing.invalidateCodes': {
    methods: ["DELETE"],
    pattern: '/api/v1/pairing-codes',
    tokens: [{"old":"/api/v1/pairing-codes","type":0,"val":"api","end":""},{"old":"/api/v1/pairing-codes","type":0,"val":"v1","end":""},{"old":"/api/v1/pairing-codes","type":0,"val":"pairing-codes","end":""}],
    types: placeholder as Registry['pairing.invalidateCodes']['types'],
  },
  'distribution.index': {
    methods: ["GET","HEAD"],
    pattern: '/install',
    tokens: [{"old":"/install","type":0,"val":"install","end":""}],
    types: placeholder as Registry['distribution.index']['types'],
  },
  'distribution.version': {
    methods: ["GET","HEAD"],
    pattern: '/install/version.json',
    tokens: [{"old":"/install/version.json","type":0,"val":"install","end":""},{"old":"/install/version.json","type":0,"val":"version.json","end":""}],
    types: placeholder as Registry['distribution.version']['types'],
  },
  'distribution.apk': {
    methods: ["GET","HEAD"],
    pattern: '/install/budget.apk',
    tokens: [{"old":"/install/budget.apk","type":0,"val":"install","end":""},{"old":"/install/budget.apk","type":0,"val":"budget.apk","end":""}],
    types: placeholder as Registry['distribution.apk']['types'],
  },
  'categories.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/categories',
    tokens: [{"old":"/api/v1/categories","type":0,"val":"api","end":""},{"old":"/api/v1/categories","type":0,"val":"v1","end":""},{"old":"/api/v1/categories","type":0,"val":"categories","end":""}],
    types: placeholder as Registry['categories.index']['types'],
  },
  'categories.store': {
    methods: ["POST"],
    pattern: '/api/v1/categories',
    tokens: [{"old":"/api/v1/categories","type":0,"val":"api","end":""},{"old":"/api/v1/categories","type":0,"val":"v1","end":""},{"old":"/api/v1/categories","type":0,"val":"categories","end":""}],
    types: placeholder as Registry['categories.store']['types'],
  },
  'categories.update': {
    methods: ["PATCH"],
    pattern: '/api/v1/categories/:id',
    tokens: [{"old":"/api/v1/categories/:id","type":0,"val":"api","end":""},{"old":"/api/v1/categories/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/categories/:id","type":0,"val":"categories","end":""},{"old":"/api/v1/categories/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['categories.update']['types'],
  },
  'categories.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/categories/:id',
    tokens: [{"old":"/api/v1/categories/:id","type":0,"val":"api","end":""},{"old":"/api/v1/categories/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/categories/:id","type":0,"val":"categories","end":""},{"old":"/api/v1/categories/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['categories.destroy']['types'],
  },
  'entries.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/entries',
    tokens: [{"old":"/api/v1/entries","type":0,"val":"api","end":""},{"old":"/api/v1/entries","type":0,"val":"v1","end":""},{"old":"/api/v1/entries","type":0,"val":"entries","end":""}],
    types: placeholder as Registry['entries.index']['types'],
  },
  'entries.store': {
    methods: ["POST"],
    pattern: '/api/v1/entries',
    tokens: [{"old":"/api/v1/entries","type":0,"val":"api","end":""},{"old":"/api/v1/entries","type":0,"val":"v1","end":""},{"old":"/api/v1/entries","type":0,"val":"entries","end":""}],
    types: placeholder as Registry['entries.store']['types'],
  },
  'entries.history': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/entries/:id/history',
    tokens: [{"old":"/api/v1/entries/:id/history","type":0,"val":"api","end":""},{"old":"/api/v1/entries/:id/history","type":0,"val":"v1","end":""},{"old":"/api/v1/entries/:id/history","type":0,"val":"entries","end":""},{"old":"/api/v1/entries/:id/history","type":1,"val":"id","end":""},{"old":"/api/v1/entries/:id/history","type":0,"val":"history","end":""}],
    types: placeholder as Registry['entries.history']['types'],
  },
  'entries.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/entries/:id',
    tokens: [{"old":"/api/v1/entries/:id","type":0,"val":"api","end":""},{"old":"/api/v1/entries/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/entries/:id","type":0,"val":"entries","end":""},{"old":"/api/v1/entries/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['entries.show']['types'],
  },
  'entries.update': {
    methods: ["PATCH"],
    pattern: '/api/v1/entries/:id',
    tokens: [{"old":"/api/v1/entries/:id","type":0,"val":"api","end":""},{"old":"/api/v1/entries/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/entries/:id","type":0,"val":"entries","end":""},{"old":"/api/v1/entries/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['entries.update']['types'],
  },
  'entries.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/entries/:id',
    tokens: [{"old":"/api/v1/entries/:id","type":0,"val":"api","end":""},{"old":"/api/v1/entries/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/entries/:id","type":0,"val":"entries","end":""},{"old":"/api/v1/entries/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['entries.destroy']['types'],
  },
  'balances.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/balances',
    tokens: [{"old":"/api/v1/balances","type":0,"val":"api","end":""},{"old":"/api/v1/balances","type":0,"val":"v1","end":""},{"old":"/api/v1/balances","type":0,"val":"balances","end":""}],
    types: placeholder as Registry['balances.show']['types'],
  },
  'balances.actuals': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/months/:month/actuals',
    tokens: [{"old":"/api/v1/months/:month/actuals","type":0,"val":"api","end":""},{"old":"/api/v1/months/:month/actuals","type":0,"val":"v1","end":""},{"old":"/api/v1/months/:month/actuals","type":0,"val":"months","end":""},{"old":"/api/v1/months/:month/actuals","type":1,"val":"month","end":""},{"old":"/api/v1/months/:month/actuals","type":0,"val":"actuals","end":""}],
    types: placeholder as Registry['balances.actuals']['types'],
  },
  'recurring_rules.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/recurring-rules',
    tokens: [{"old":"/api/v1/recurring-rules","type":0,"val":"api","end":""},{"old":"/api/v1/recurring-rules","type":0,"val":"v1","end":""},{"old":"/api/v1/recurring-rules","type":0,"val":"recurring-rules","end":""}],
    types: placeholder as Registry['recurring_rules.index']['types'],
  },
  'recurring_rules.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/recurring-rules/:id',
    tokens: [{"old":"/api/v1/recurring-rules/:id","type":0,"val":"api","end":""},{"old":"/api/v1/recurring-rules/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/recurring-rules/:id","type":0,"val":"recurring-rules","end":""},{"old":"/api/v1/recurring-rules/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['recurring_rules.show']['types'],
  },
  'recurring_rules.store': {
    methods: ["POST"],
    pattern: '/api/v1/recurring-rules',
    tokens: [{"old":"/api/v1/recurring-rules","type":0,"val":"api","end":""},{"old":"/api/v1/recurring-rules","type":0,"val":"v1","end":""},{"old":"/api/v1/recurring-rules","type":0,"val":"recurring-rules","end":""}],
    types: placeholder as Registry['recurring_rules.store']['types'],
  },
  'recurring_rules.update': {
    methods: ["PATCH"],
    pattern: '/api/v1/recurring-rules/:id',
    tokens: [{"old":"/api/v1/recurring-rules/:id","type":0,"val":"api","end":""},{"old":"/api/v1/recurring-rules/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/recurring-rules/:id","type":0,"val":"recurring-rules","end":""},{"old":"/api/v1/recurring-rules/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['recurring_rules.update']['types'],
  },
  'recurring_rules.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/recurring-rules/:id',
    tokens: [{"old":"/api/v1/recurring-rules/:id","type":0,"val":"api","end":""},{"old":"/api/v1/recurring-rules/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/recurring-rules/:id","type":0,"val":"recurring-rules","end":""},{"old":"/api/v1/recurring-rules/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['recurring_rules.destroy']['types'],
  },
  'occurrences.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/occurrences',
    tokens: [{"old":"/api/v1/occurrences","type":0,"val":"api","end":""},{"old":"/api/v1/occurrences","type":0,"val":"v1","end":""},{"old":"/api/v1/occurrences","type":0,"val":"occurrences","end":""}],
    types: placeholder as Registry['occurrences.index']['types'],
  },
  'occurrences.confirm': {
    methods: ["POST"],
    pattern: '/api/v1/occurrences/:id/confirm',
    tokens: [{"old":"/api/v1/occurrences/:id/confirm","type":0,"val":"api","end":""},{"old":"/api/v1/occurrences/:id/confirm","type":0,"val":"v1","end":""},{"old":"/api/v1/occurrences/:id/confirm","type":0,"val":"occurrences","end":""},{"old":"/api/v1/occurrences/:id/confirm","type":1,"val":"id","end":""},{"old":"/api/v1/occurrences/:id/confirm","type":0,"val":"confirm","end":""}],
    types: placeholder as Registry['occurrences.confirm']['types'],
  },
  'sync.push': {
    methods: ["POST"],
    pattern: '/api/v1/sync/push',
    tokens: [{"old":"/api/v1/sync/push","type":0,"val":"api","end":""},{"old":"/api/v1/sync/push","type":0,"val":"v1","end":""},{"old":"/api/v1/sync/push","type":0,"val":"sync","end":""},{"old":"/api/v1/sync/push","type":0,"val":"push","end":""}],
    types: placeholder as Registry['sync.push']['types'],
  },
  'sync.changes': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/sync/changes',
    tokens: [{"old":"/api/v1/sync/changes","type":0,"val":"api","end":""},{"old":"/api/v1/sync/changes","type":0,"val":"v1","end":""},{"old":"/api/v1/sync/changes","type":0,"val":"sync","end":""},{"old":"/api/v1/sync/changes","type":0,"val":"changes","end":""}],
    types: placeholder as Registry['sync.changes']['types'],
  },
  'sync.conflicts': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/sync/conflicts',
    tokens: [{"old":"/api/v1/sync/conflicts","type":0,"val":"api","end":""},{"old":"/api/v1/sync/conflicts","type":0,"val":"v1","end":""},{"old":"/api/v1/sync/conflicts","type":0,"val":"sync","end":""},{"old":"/api/v1/sync/conflicts","type":0,"val":"conflicts","end":""}],
    types: placeholder as Registry['sync.conflicts']['types'],
  },
  'sync.resolve': {
    methods: ["POST"],
    pattern: '/api/v1/sync/conflicts/:id/resolve',
    tokens: [{"old":"/api/v1/sync/conflicts/:id/resolve","type":0,"val":"api","end":""},{"old":"/api/v1/sync/conflicts/:id/resolve","type":0,"val":"v1","end":""},{"old":"/api/v1/sync/conflicts/:id/resolve","type":0,"val":"sync","end":""},{"old":"/api/v1/sync/conflicts/:id/resolve","type":0,"val":"conflicts","end":""},{"old":"/api/v1/sync/conflicts/:id/resolve","type":1,"val":"id","end":""},{"old":"/api/v1/sync/conflicts/:id/resolve","type":0,"val":"resolve","end":""}],
    types: placeholder as Registry['sync.resolve']['types'],
  },
  'monthly_plans.set_estimate': {
    methods: ["PUT"],
    pattern: '/api/v1/months/:month/estimates/:categoryId',
    tokens: [{"old":"/api/v1/months/:month/estimates/:categoryId","type":0,"val":"api","end":""},{"old":"/api/v1/months/:month/estimates/:categoryId","type":0,"val":"v1","end":""},{"old":"/api/v1/months/:month/estimates/:categoryId","type":0,"val":"months","end":""},{"old":"/api/v1/months/:month/estimates/:categoryId","type":1,"val":"month","end":""},{"old":"/api/v1/months/:month/estimates/:categoryId","type":0,"val":"estimates","end":""},{"old":"/api/v1/months/:month/estimates/:categoryId","type":1,"val":"categoryId","end":""}],
    types: placeholder as Registry['monthly_plans.set_estimate']['types'],
  },
  'monthly_plans.set_savings_target': {
    methods: ["PUT"],
    pattern: '/api/v1/months/:month/savings-target',
    tokens: [{"old":"/api/v1/months/:month/savings-target","type":0,"val":"api","end":""},{"old":"/api/v1/months/:month/savings-target","type":0,"val":"v1","end":""},{"old":"/api/v1/months/:month/savings-target","type":0,"val":"months","end":""},{"old":"/api/v1/months/:month/savings-target","type":1,"val":"month","end":""},{"old":"/api/v1/months/:month/savings-target","type":0,"val":"savings-target","end":""}],
    types: placeholder as Registry['monthly_plans.set_savings_target']['types'],
  },
  'monthly_plans.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/months/:month/plan',
    tokens: [{"old":"/api/v1/months/:month/plan","type":0,"val":"api","end":""},{"old":"/api/v1/months/:month/plan","type":0,"val":"v1","end":""},{"old":"/api/v1/months/:month/plan","type":0,"val":"months","end":""},{"old":"/api/v1/months/:month/plan","type":1,"val":"month","end":""},{"old":"/api/v1/months/:month/plan","type":0,"val":"plan","end":""}],
    types: placeholder as Registry['monthly_plans.show']['types'],
  },
  'monthly_plans.suggestion': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/months/:month/suggestions/:categoryId',
    tokens: [{"old":"/api/v1/months/:month/suggestions/:categoryId","type":0,"val":"api","end":""},{"old":"/api/v1/months/:month/suggestions/:categoryId","type":0,"val":"v1","end":""},{"old":"/api/v1/months/:month/suggestions/:categoryId","type":0,"val":"months","end":""},{"old":"/api/v1/months/:month/suggestions/:categoryId","type":1,"val":"month","end":""},{"old":"/api/v1/months/:month/suggestions/:categoryId","type":0,"val":"suggestions","end":""},{"old":"/api/v1/months/:month/suggestions/:categoryId","type":1,"val":"categoryId","end":""}],
    types: placeholder as Registry['monthly_plans.suggestion']['types'],
  },
  'docs.index': {
    methods: ["GET","HEAD"],
    pattern: '/docs',
    tokens: [{"old":"/docs","type":0,"val":"docs","end":""}],
    types: placeholder as Registry['docs.index']['types'],
  },
  'docs.spec': {
    methods: ["GET","HEAD"],
    pattern: '/openapi/v1.json',
    tokens: [{"old":"/openapi/v1.json","type":0,"val":"openapi","end":""},{"old":"/openapi/v1.json","type":0,"val":"v1.json","end":""}],
    types: placeholder as Registry['docs.spec']['types'],
  },
} as const satisfies Record<string, AdonisEndpoint>

export { routes }

export const registry = {
  routes,
  $tree: {} as ApiDefinition,
}

declare module '@tuyau/core/types' {
  export interface UserRegistry {
    routes: typeof routes
    $tree: ApiDefinition
  }
}
