package com.household.budget.application

import com.household.budget.data.local.HouseholdEntity
import com.household.budget.data.local.MonthSnapshotEntity
import com.household.budget.ui.MonthDashboardState
import java.time.Instant
import java.time.YearMonth
import java.time.ZoneId
import org.json.JSONObject

fun dashboardFromCache(household: HouseholdEntity?, selectedMonth: YearMonth, snapshot: MonthSnapshotEntity?, now: Instant): MonthDashboardState {
    val zone = ZoneId.of(household?.timeZone ?: "America/Toronto")
    val empty = MonthDashboardState.empty(zone, now).copy(selectedMonth = selectedMonth)
    if (snapshot == null || snapshot.month != selectedMonth.toString()) return empty
    val plan = JSONObject(snapshot.planJson)
    val actuals = JSONObject(snapshot.actualsJson)
    val balances = JSONObject(snapshot.balancesJson)
    return empty.copy(
        plannedMoneyLeftCents = plan.getLong("moneyLeftCents"),
        actualMoneyLeftTodayCents = actuals.getLong("moneyLeftTodayCents"),
        spendableCents = balances.getLong("spendableCents"),
        savingsCents = balances.getLong("savingsCents"),
        combinedCents = balances.getLong("combinedCents"),
        incomeCents = if(actuals.has("incomeCents")) actuals.getLong("incomeCents") else null,
        spendingCents = if(actuals.has("spendingCents")) actuals.getLong("spendingCents") else null,
    )
}
