import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'health.show': { paramsTuple?: []; params?: {} }
    'households.bootstrap': { paramsTuple?: []; params?: {} }
    'pairing.pair': { paramsTuple?: []; params?: {} }
    'households.show': { paramsTuple?: []; params?: {} }
    'households.update': { paramsTuple?: []; params?: {} }
    'devices.index': { paramsTuple?: []; params?: {} }
    'devices.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'devices.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'pairing.createCode': { paramsTuple?: []; params?: {} }
    'pairing.invalidateCodes': { paramsTuple?: []; params?: {} }
    'distribution.index': { paramsTuple?: []; params?: {} }
    'distribution.version': { paramsTuple?: []; params?: {} }
    'distribution.apk': { paramsTuple?: []; params?: {} }
    'categories.index': { paramsTuple?: []; params?: {} }
    'categories.store': { paramsTuple?: []; params?: {} }
    'categories.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'entries.index': { paramsTuple?: []; params?: {} }
    'entries.store': { paramsTuple?: []; params?: {} }
    'entries.history': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'entries.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'entries.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'entries.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'balances.show': { paramsTuple?: []; params?: {} }
    'balances.actuals': { paramsTuple: [ParamValue]; params: {'month': ParamValue} }
    'recurring_rules.index': { paramsTuple?: []; params?: {} }
    'recurring_rules.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'recurring_rules.store': { paramsTuple?: []; params?: {} }
    'recurring_rules.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'recurring_rules.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'occurrences.index': { paramsTuple?: []; params?: {} }
    'occurrences.confirm': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'sync.push': { paramsTuple?: []; params?: {} }
    'sync.changes': { paramsTuple?: []; params?: {} }
    'sync.conflicts': { paramsTuple?: []; params?: {} }
    'sync.resolve': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'monthly_plans.set_estimate': { paramsTuple: [ParamValue,ParamValue]; params: {'month': ParamValue,'categoryId': ParamValue} }
    'monthly_plans.set_savings_target': { paramsTuple: [ParamValue]; params: {'month': ParamValue} }
    'monthly_plans.show': { paramsTuple: [ParamValue]; params: {'month': ParamValue} }
    'monthly_plans.suggestion': { paramsTuple: [ParamValue,ParamValue]; params: {'month': ParamValue,'categoryId': ParamValue} }
    'docs.index': { paramsTuple?: []; params?: {} }
    'docs.spec': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'health.show': { paramsTuple?: []; params?: {} }
    'households.show': { paramsTuple?: []; params?: {} }
    'devices.index': { paramsTuple?: []; params?: {} }
    'distribution.index': { paramsTuple?: []; params?: {} }
    'distribution.version': { paramsTuple?: []; params?: {} }
    'distribution.apk': { paramsTuple?: []; params?: {} }
    'categories.index': { paramsTuple?: []; params?: {} }
    'entries.index': { paramsTuple?: []; params?: {} }
    'entries.history': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'entries.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'balances.show': { paramsTuple?: []; params?: {} }
    'balances.actuals': { paramsTuple: [ParamValue]; params: {'month': ParamValue} }
    'recurring_rules.index': { paramsTuple?: []; params?: {} }
    'recurring_rules.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'occurrences.index': { paramsTuple?: []; params?: {} }
    'sync.changes': { paramsTuple?: []; params?: {} }
    'sync.conflicts': { paramsTuple?: []; params?: {} }
    'monthly_plans.show': { paramsTuple: [ParamValue]; params: {'month': ParamValue} }
    'monthly_plans.suggestion': { paramsTuple: [ParamValue,ParamValue]; params: {'month': ParamValue,'categoryId': ParamValue} }
    'docs.index': { paramsTuple?: []; params?: {} }
    'docs.spec': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'health.show': { paramsTuple?: []; params?: {} }
    'households.show': { paramsTuple?: []; params?: {} }
    'devices.index': { paramsTuple?: []; params?: {} }
    'distribution.index': { paramsTuple?: []; params?: {} }
    'distribution.version': { paramsTuple?: []; params?: {} }
    'distribution.apk': { paramsTuple?: []; params?: {} }
    'categories.index': { paramsTuple?: []; params?: {} }
    'entries.index': { paramsTuple?: []; params?: {} }
    'entries.history': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'entries.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'balances.show': { paramsTuple?: []; params?: {} }
    'balances.actuals': { paramsTuple: [ParamValue]; params: {'month': ParamValue} }
    'recurring_rules.index': { paramsTuple?: []; params?: {} }
    'recurring_rules.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'occurrences.index': { paramsTuple?: []; params?: {} }
    'sync.changes': { paramsTuple?: []; params?: {} }
    'sync.conflicts': { paramsTuple?: []; params?: {} }
    'monthly_plans.show': { paramsTuple: [ParamValue]; params: {'month': ParamValue} }
    'monthly_plans.suggestion': { paramsTuple: [ParamValue,ParamValue]; params: {'month': ParamValue,'categoryId': ParamValue} }
    'docs.index': { paramsTuple?: []; params?: {} }
    'docs.spec': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'households.bootstrap': { paramsTuple?: []; params?: {} }
    'pairing.pair': { paramsTuple?: []; params?: {} }
    'pairing.createCode': { paramsTuple?: []; params?: {} }
    'categories.store': { paramsTuple?: []; params?: {} }
    'entries.store': { paramsTuple?: []; params?: {} }
    'recurring_rules.store': { paramsTuple?: []; params?: {} }
    'occurrences.confirm': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'sync.push': { paramsTuple?: []; params?: {} }
    'sync.resolve': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  PATCH: {
    'households.update': { paramsTuple?: []; params?: {} }
    'devices.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'entries.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'recurring_rules.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  DELETE: {
    'devices.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'pairing.invalidateCodes': { paramsTuple?: []; params?: {} }
    'categories.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'entries.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'recurring_rules.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  PUT: {
    'monthly_plans.set_estimate': { paramsTuple: [ParamValue,ParamValue]; params: {'month': ParamValue,'categoryId': ParamValue} }
    'monthly_plans.set_savings_target': { paramsTuple: [ParamValue]; params: {'month': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}