package com.household.budget.reminders

import com.household.budget.data.local.BudgetDatabase
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import org.json.JSONObject
import java.time.Clock
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId

/** Uses accepted Room data plus queued edits, so cancelling a bill works while offline. */
class ReminderCoordinator(private val database: BudgetDatabase, private val clock: Clock, private val replace: (List<ScheduledReminder>) -> Boolean) {
    suspend fun watch(enabled: Flow<Boolean>) {
        val dao = database.budgetDao()
        combine(dao.observeHousehold(), dao.observeOccurrences("0001-01-01", "9999-12-31"),
            dao.observeRules(), dao.observePendingOperations(), enabled) { _, _, _, _, allowed -> allowed }
            .collect { reschedule(it) }
    }

    suspend fun reschedule(enabled: Boolean = true): Boolean {
        if (!enabled) return replace(emptyList())
        val dao = database.budgetDao()
        val home = dao.observeHousehold().first() ?: return replace(emptyList())
        val pending = dao.observePendingOperations().first().filter { it.state == "pending" }
        val hour = pending.lastOrNull { it.entityType == "household" && it.entityId == home.id }
            ?.valueJson?.let { JSONObject(it).optString("reminderTime", home.reminderTime) } ?: home.reminderTime
        val suppressedOccurrences = pending.filter { it.entityType == "occurrence" }.map { it.entityId }.toSet()
        val rules = dao.observeRules().first().associateBy { it.id }
        val suppressedRules = pending.filter { it.entityType == "recurring_rule" && (it.action == "delete" || it.valueJson?.let { raw ->
            val value = JSONObject(raw)
            (value.has("active") && !value.getBoolean("active")) ||
                listOf("frequency", "interval", "startsOn", "endsOn", "scheduleDetails").any(value::has)
        } == true) }.map { it.entityId }.toSet()
        val zone = ZoneId.of(home.timeZone)
        val today = LocalDate.now(clock.withZone(zone))
        val occurrences = dao.observeOccurrences(today.toString(), today.plusDays(60).toString()).first()
            .filter { it.ruleKind in setOf("income", "bill", "subscription") && it.ruleId !in suppressedRules && rules[it.ruleId]?.active == true }
            .map { ReminderOccurrence(it.id, rules[it.ruleId]?.name ?: it.ruleName, LocalDate.parse(it.expectedDate), it.status == "confirmed" || it.id in suppressedOccurrences) }
        return replace(planReminders(occurrences, LocalTime.parse(hour), zone, clock.instant()))
    }
}
