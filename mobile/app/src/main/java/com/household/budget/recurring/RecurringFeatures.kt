package com.household.budget.recurring

import com.household.budget.application.BudgetGraph
import com.household.budget.application.BudgetSession
import com.household.budget.data.local.RecurringRuleEntity
import com.household.budget.data.local.OccurrenceEntity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.*
import java.time.YearMonth

@OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
class RecurringFeatures(private val graph: BudgetGraph, private val session: BudgetSession,
    private val selectedMonth: StateFlow<YearMonth>, scope: CoroutineScope) {
    val rules = graph.database.flatMapLatest { it.budgetDao().observeRules() }
        .stateIn(scope, SharingStarted.WhileSubscribed(5000), emptyList<RecurringRuleEntity>())
    val occurrences = combine(graph.database, selectedMonth) { database, month -> database to month }
        .flatMapLatest { (db, month) -> db.budgetDao().observeOccurrences(month.atDay(1).toString(), month.atEndOfMonth().toString()) }
        .stateIn(scope, SharingStarted.WhileSubscribed(5000), emptyList<OccurrenceEntity>())
    fun saveRule(draft: RecurringDraft, id: String?, revision: Long) {
        session.mutate(selectedMonth.value, {
            val value = recurringDraftToJson(draft)
            if (id == null) value.remove("active")
            graph.queueMutation("recurring_rule", if (id == null) "create" else "update",
                id ?: java.util.UUID.randomUUID().toString(), revision, value)
        }, {})
    }
    fun deleteRule(id: String, revision: Long) {
        session.mutate(selectedMonth.value, { graph.queueMutation("recurring_rule", "delete", id, revision) }, {})
    }
    fun confirm(id: String, revision: Long, date: String, amountCents: Long) {
        session.mutate(selectedMonth.value, {
            require(validRecurringDate(date)) { "Enter a valid date (YYYY-MM-DD)" }
            require(amountCents in 1..9007199254740991L) { "Amount must be positive safe integer cents" }
            graph.queueMutation("occurrence", "update", id, revision, org.json.JSONObject()
                .put("actualDate", date).put("actualAmountCents", amountCents))
        }, {})
    }
}
