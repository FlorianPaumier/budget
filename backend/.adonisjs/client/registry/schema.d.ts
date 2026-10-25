/* eslint-disable prettier/prettier */
/// <reference path="../manifest.d.ts" />

import type { ExtractBody, ExtractErrorResponse, ExtractQuery, ExtractQueryForGet, ExtractResponse } from '@tuyau/core/types'
import type { InferInput } from '@vinejs/vine/types'

export type ParamValue = string | number | bigint | boolean

export interface Registry {
  'health.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/health'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/health_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/health_controller').default['show']>>>
    }
  }
  'households.bootstrap': {
    methods: ["POST"]
    pattern: '/api/v1/bootstrap'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/access').bootstrapValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/access').bootstrapValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/households_controller').default['bootstrap']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/households_controller').default['bootstrap']>>> | { status: 422; response: { code: string; details: { field: string; message: string; rule: string }[] } }
    }
  }
  'pairing.pair': {
    methods: ["POST"]
    pattern: '/api/v1/pair'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/access').pairValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/access').pairValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/pairing_controller').default['pair']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/pairing_controller').default['pair']>>> | { status: 422; response: { code: string; details: { field: string; message: string; rule: string }[] } }
    }
  }
  'households.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/household'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/households_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/households_controller').default['show']>>>
    }
  }
  'households.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/household'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/access').reminderValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/access').reminderValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/households_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/households_controller').default['update']>>> | { status: 422; response: { code: string; details: { field: string; message: string; rule: string }[] } }
    }
  }
  'devices.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/devices'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/devices_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/devices_controller').default['index']>>>
    }
  }
  'devices.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/devices/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/access').accessIdValidator)>|InferInput<(typeof import('#validators/access').deviceLabelValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/access').accessIdValidator)>|InferInput<(typeof import('#validators/access').deviceLabelValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/devices_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/devices_controller').default['update']>>> | { status: 422; response: { code: string; details: { field: string; message: string; rule: string }[] } }
    }
  }
  'devices.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/devices/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/access').accessIdValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/access').accessIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/devices_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/devices_controller').default['destroy']>>> | { status: 422; response: { code: string; details: { field: string; message: string; rule: string }[] } }
    }
  }
  'pairing.createCode': {
    methods: ["POST"]
    pattern: '/api/v1/pairing-codes'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/pairing_controller').default['createCode']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/pairing_controller').default['createCode']>>>
    }
  }
  'pairing.invalidateCodes': {
    methods: ["DELETE"]
    pattern: '/api/v1/pairing-codes'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/pairing_controller').default['invalidateCodes']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/pairing_controller').default['invalidateCodes']>>>
    }
  }
  'distribution.index': {
    methods: ["GET","HEAD"]
    pattern: '/install'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/distribution_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/distribution_controller').default['index']>>>
    }
  }
  'distribution.version': {
    methods: ["GET","HEAD"]
    pattern: '/install/version.json'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/distribution_controller').default['version']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/distribution_controller').default['version']>>>
    }
  }
  'distribution.apk': {
    methods: ["GET","HEAD"]
    pattern: '/install/budget.apk'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/distribution_controller').default['apk']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/distribution_controller').default['apk']>>>
    }
  }
  'categories.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/categories'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['index']>>>
    }
  }
  'categories.store': {
    methods: ["POST"]
    pattern: '/api/v1/categories'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/ledger').categoryCreateValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/ledger').categoryCreateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['store']>>> | { status: 422; response: { code: string; details: { field: string; message: string; rule: string }[] } }
    }
  }
  'categories.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/categories/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/ledger').ledgerIdValidator)>|InferInput<(typeof import('#validators/ledger').categoryUpdateValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/ledger').ledgerIdValidator)>|InferInput<(typeof import('#validators/ledger').categoryUpdateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['update']>>> | { status: 422; response: { code: string; details: { field: string; message: string; rule: string }[] } }
    }
  }
  'categories.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/categories/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/ledger').ledgerIdValidator)>|InferInput<(typeof import('#validators/ledger').deletionValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/ledger').ledgerIdValidator)>|InferInput<(typeof import('#validators/ledger').deletionValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['destroy']>>> | { status: 422; response: { code: string; details: { field: string; message: string; rule: string }[] } }
    }
  }
  'entries.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/entries'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/ledger').entriesQueryValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/entries_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/entries_controller').default['index']>>> | { status: 422; response: { code: string; details: { field: string; message: string; rule: string }[] } }
    }
  }
  'entries.store': {
    methods: ["POST"]
    pattern: '/api/v1/entries'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/ledger').entryCreateValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/ledger').entryCreateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/entries_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/entries_controller').default['store']>>> | { status: 422; response: { code: string; details: { field: string; message: string; rule: string }[] } }
    }
  }
  'entries.history': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/entries/:id/history'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/ledger').ledgerIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/entries_controller').default['history']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/entries_controller').default['history']>>> | { status: 422; response: { code: string; details: { field: string; message: string; rule: string }[] } }
    }
  }
  'entries.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/entries/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/ledger').ledgerIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/entries_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/entries_controller').default['show']>>> | { status: 422; response: { code: string; details: { field: string; message: string; rule: string }[] } }
    }
  }
  'entries.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/entries/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/ledger').ledgerIdValidator)>|InferInput<(typeof import('#validators/ledger').entryUpdateValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/ledger').ledgerIdValidator)>|InferInput<(typeof import('#validators/ledger').entryUpdateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/entries_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/entries_controller').default['update']>>> | { status: 422; response: { code: string; details: { field: string; message: string; rule: string }[] } }
    }
  }
  'entries.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/entries/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/ledger').ledgerIdValidator)>|InferInput<(typeof import('#validators/ledger').deletionValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/ledger').ledgerIdValidator)>|InferInput<(typeof import('#validators/ledger').deletionValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/entries_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/entries_controller').default['destroy']>>> | { status: 422; response: { code: string; details: { field: string; message: string; rule: string }[] } }
    }
  }
  'balances.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/balances'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/ledger').balancesQueryValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/balances_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/balances_controller').default['show']>>> | { status: 422; response: { code: string; details: { field: string; message: string; rule: string }[] } }
    }
  }
  'balances.actuals': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/months/:month/actuals'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { month: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/ledger').monthPathValidator)>|InferInput<(typeof import('#validators/ledger').actualsQueryValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/balances_controller').default['actuals']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/balances_controller').default['actuals']>>> | { status: 422; response: { code: string; details: { field: string; message: string; rule: string }[] } }
    }
  }
  'recurring_rules.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/recurring-rules'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/recurring_rules_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/recurring_rules_controller').default['index']>>>
    }
  }
  'recurring_rules.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/recurring-rules/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#app/validators/recurrence.js').ruleIdValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/recurring_rules_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/recurring_rules_controller').default['show']>>> | { status: 422; response: { code: string; details: { field: string; message: string; rule: string }[] } }
    }
  }
  'recurring_rules.store': {
    methods: ["POST"]
    pattern: '/api/v1/recurring-rules'
    types: {
      body: ExtractBody<InferInput<(typeof import('#app/validators/recurrence.js').createRuleValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#app/validators/recurrence.js').createRuleValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/recurring_rules_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/recurring_rules_controller').default['store']>>> | { status: 422; response: { code: string; details: { field: string; message: string; rule: string }[] } }
    }
  }
  'recurring_rules.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/recurring-rules/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#app/validators/recurrence.js').updateRuleValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#app/validators/recurrence.js').updateRuleValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/recurring_rules_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/recurring_rules_controller').default['update']>>> | { status: 422; response: { code: string; details: { field: string; message: string; rule: string }[] } }
    }
  }
  'recurring_rules.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/recurring-rules/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#app/validators/recurrence.js').deleteRuleValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#app/validators/recurrence.js').deleteRuleValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/recurring_rules_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/recurring_rules_controller').default['destroy']>>> | { status: 422; response: { code: string; details: { field: string; message: string; rule: string }[] } }
    }
  }
  'occurrences.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/occurrences'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#app/validators/recurrence.js').occurrenceRangeValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/occurrences_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/occurrences_controller').default['index']>>> | { status: 422; response: { code: string; details: { field: string; message: string; rule: string }[] } }
    }
  }
  'occurrences.confirm': {
    methods: ["POST"]
    pattern: '/api/v1/occurrences/:id/confirm'
    types: {
      body: ExtractBody<InferInput<(typeof import('#app/validators/recurrence.js').confirmOccurrenceValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#app/validators/recurrence.js').confirmOccurrenceValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/occurrences_controller').default['confirm']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/occurrences_controller').default['confirm']>>> | { status: 422; response: { code: string; details: { field: string; message: string; rule: string }[] } }
    }
  }
  'sync.push': {
    methods: ["POST"]
    pattern: '/api/v1/sync/push'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/sync').pushValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/sync').pushValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/sync_controller').default['push']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/sync_controller').default['push']>>> | { status: 422; response: { code: string; details: { field: string; message: string; rule: string }[] } }
    }
  }
  'sync.changes': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/sync/changes'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/sync').changesValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/sync_controller').default['changes']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/sync_controller').default['changes']>>> | { status: 422; response: { code: string; details: { field: string; message: string; rule: string }[] } }
    }
  }
  'sync.conflicts': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/sync/conflicts'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/sync_controller').default['conflicts']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/sync_controller').default['conflicts']>>>
    }
  }
  'sync.resolve': {
    methods: ["POST"]
    pattern: '/api/v1/sync/conflicts/:id/resolve'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/sync').resolveValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/sync').resolveValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/sync_controller').default['resolve']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/sync_controller').default['resolve']>>> | { status: 422; response: { code: string; details: { field: string; message: string; rule: string }[] } }
    }
  }
  'monthly_plans.set_estimate': {
    methods: ["PUT"]
    pattern: '/api/v1/months/:month/estimates/:categoryId'
    types: {
      body: ExtractBody<InferInput<(typeof import('#app/validators/monthly_planning.js').estimateValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { month: ParamValue; categoryId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#app/validators/monthly_planning.js').estimateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/monthly_plans_controller').default['setEstimate']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/monthly_plans_controller').default['setEstimate']>>> | { status: 422; response: { code: string; details: { field: string; message: string; rule: string }[] } }
    }
  }
  'monthly_plans.set_savings_target': {
    methods: ["PUT"]
    pattern: '/api/v1/months/:month/savings-target'
    types: {
      body: ExtractBody<InferInput<(typeof import('#app/validators/monthly_planning.js').savingsTargetValidator)>>
      paramsTuple: [ParamValue]
      params: { month: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#app/validators/monthly_planning.js').savingsTargetValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/monthly_plans_controller').default['setSavingsTarget']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/monthly_plans_controller').default['setSavingsTarget']>>> | { status: 422; response: { code: string; details: { field: string; message: string; rule: string }[] } }
    }
  }
  'monthly_plans.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/months/:month/plan'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { month: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#app/validators/monthly_planning.js').planMonthValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/monthly_plans_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/monthly_plans_controller').default['show']>>> | { status: 422; response: { code: string; details: { field: string; message: string; rule: string }[] } }
    }
  }
  'monthly_plans.suggestion': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/months/:month/suggestions/:categoryId'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { month: ParamValue; categoryId: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#app/validators/monthly_planning.js').suggestionValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/monthly_plans_controller').default['suggestion']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/monthly_plans_controller').default['suggestion']>>> | { status: 422; response: { code: string; details: { field: string; message: string; rule: string }[] } }
    }
  }
  'docs.index': {
    methods: ["GET","HEAD"]
    pattern: '/docs'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/docs_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/docs_controller').default['index']>>>
    }
  }
  'docs.spec': {
    methods: ["GET","HEAD"]
    pattern: '/openapi/v1.json'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/docs_controller').default['spec']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/docs_controller').default['spec']>>>
    }
  }
}
