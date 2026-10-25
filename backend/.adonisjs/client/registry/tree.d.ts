/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  health: {
    show: typeof routes['health.show']
  }
  households: {
    bootstrap: typeof routes['households.bootstrap']
    show: typeof routes['households.show']
    update: typeof routes['households.update']
  }
  pairing: {
    pair: typeof routes['pairing.pair']
    createCode: typeof routes['pairing.createCode']
    invalidateCodes: typeof routes['pairing.invalidateCodes']
  }
  devices: {
    index: typeof routes['devices.index']
    update: typeof routes['devices.update']
    destroy: typeof routes['devices.destroy']
  }
  distribution: {
    index: typeof routes['distribution.index']
    version: typeof routes['distribution.version']
    apk: typeof routes['distribution.apk']
  }
  categories: {
    index: typeof routes['categories.index']
    store: typeof routes['categories.store']
    update: typeof routes['categories.update']
    destroy: typeof routes['categories.destroy']
  }
  entries: {
    index: typeof routes['entries.index']
    store: typeof routes['entries.store']
    history: typeof routes['entries.history']
    show: typeof routes['entries.show']
    update: typeof routes['entries.update']
    destroy: typeof routes['entries.destroy']
  }
  balances: {
    show: typeof routes['balances.show']
    actuals: typeof routes['balances.actuals']
  }
  recurringRules: {
    index: typeof routes['recurring_rules.index']
    show: typeof routes['recurring_rules.show']
    store: typeof routes['recurring_rules.store']
    update: typeof routes['recurring_rules.update']
    destroy: typeof routes['recurring_rules.destroy']
  }
  occurrences: {
    index: typeof routes['occurrences.index']
    confirm: typeof routes['occurrences.confirm']
  }
  sync: {
    push: typeof routes['sync.push']
    changes: typeof routes['sync.changes']
    conflicts: typeof routes['sync.conflicts']
    resolve: typeof routes['sync.resolve']
  }
  monthlyPlans: {
    setEstimate: typeof routes['monthly_plans.set_estimate']
    setSavingsTarget: typeof routes['monthly_plans.set_savings_target']
    show: typeof routes['monthly_plans.show']
    suggestion: typeof routes['monthly_plans.suggestion']
  }
  docs: {
    index: typeof routes['docs.index']
    spec: typeof routes['docs.spec']
  }
}
