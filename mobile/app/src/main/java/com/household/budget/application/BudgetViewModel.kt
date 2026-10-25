package com.household.budget.application

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.household.budget.ui.EntryDraft
import com.household.budget.ui.EntryCategory
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.YearMonth
import java.time.ZoneId

@OptIn(ExperimentalCoroutinesApi::class)
class BudgetViewModel(val graph: BudgetGraph) : ViewModel() {
    val session = BudgetSession(graph, viewModelScope, graph.credentials.load() != null, pairingMonth = graph::currentMonth)
    val selectedMonth = MutableStateFlow(YearMonth.now(graph.clock.withZone(ZoneId.of("America/Toronto"))))
    val householdFeatures = com.household.budget.household.HouseholdFeatures(graph, session, selectedMonth, viewModelScope)
    val recurringFeatures = com.household.budget.recurring.RecurringFeatures(graph, session, selectedMonth, viewModelScope)
    val updateResult = MutableStateFlow<com.household.budget.updates.UpdateCheck?>(null)
    val updateBusy = MutableStateFlow(false)
    fun checkUpdate() {
        if (updateBusy.value) return
        viewModelScope.launch {
            updateBusy.value = true
            try { updateResult.value = graph.checkUpdate() } finally { updateBusy.value = false }
        }
    }
    fun saveReminderTime(hour: String) {
        session.mutate(selectedMonth.value, action = { graph.queueReminderTime(hour) }, onStored = {})
    }
    private val household = graph.database.flatMapLatest { it.budgetDao().observeHousehold() }
    private val snapshots = combine(graph.database, selectedMonth) { db, month -> db to month }
        .flatMapLatest { (db, month) -> db.budgetDao().observeMonthSnapshot(month.toString()) }
    val dashboard = combine(household, selectedMonth, snapshots) { home, month, snapshot ->
        dashboardFromCache(home, month, snapshot, graph.clock.instant())
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000),
        dashboardFromCache(null, selectedMonth.value, null, graph.clock.instant()))
    val categories = householdFeatures.categoryRows
        .map { categories -> categories.filter { it.active }.map { EntryCategory(it.id, it.name) } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())
    val entries = combine(graph.database, selectedMonth) { db, month -> db to month }
        .flatMapLatest { (db, month) -> db.budgetDao().observeEntries(month.atDay(1).toString(), month.atEndOfMonth().toString()) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())
    val occurrenceEntries = graph.database.flatMapLatest {
        it.budgetDao().observeEntries("0001-01-01", "9999-12-31")
    }.map { rows -> rows.filter { it.occurrenceId != null } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())
    val pending = graph.database.flatMapLatest { it.budgetDao().observePendingOperations() }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val insightEntries = graph.database.flatMapLatest { it.budgetDao().observeEntries("0001-01-01", "9999-12-31") }
    val insightPeriod = MutableStateFlow(InsightPeriod.MONTH)
    val insights = combine(selectedMonth, insightEntries, categories, household) { month, rows, cats, home ->
        val today = java.time.LocalDate.now(graph.clock.withZone(ZoneId.of(home?.timeZone ?: "America/Toronto")))
        periodInsights(month, InsightPeriod.MONTH, com.household.budget.ui.entryRowsFromCache(rows, cats, emptyList()), today)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), FinancialInsights(selectedMonth.value))
    val statistics = combine(selectedMonth, insightPeriod, insightEntries, categories, household) { month, period, rows, cats, home ->
        val today = java.time.LocalDate.now(graph.clock.withZone(ZoneId.of(home?.timeZone ?: "America/Toronto")))
        periodInsights(month, period, com.household.budget.ui.entryRowsFromCache(rows, cats, emptyList()), today)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), FinancialInsights(selectedMonth.value))

    val reminderTime = combine(household, pending) { home, operations ->
        operations.lastOrNull { it.entityType == "household" && it.state == "pending" }?.valueJson
            ?.let { org.json.JSONObject(it).optString("reminderTime", home?.reminderTime ?: "09:00") }
            ?: home?.reminderTime ?: "09:00"
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), "09:00")

    private val acceptedEstimates = combine(graph.database, selectedMonth) { db, month -> db to month }
        .flatMapLatest { (db, month) -> db.budgetDao().observeEstimates(month.toString()) }
    private val cachedSuggestions = combine(graph.database, selectedMonth) { db, month -> db to month }
        .flatMapLatest { (db, month) -> db.budgetDao().observeCaches("suggestion:$month:") }
        .map { documents -> documents.mapNotNull { runCatching {
            com.household.budget.household.HouseholdActions.parseSuggestion(it.payloadJson)
        }.getOrNull() } }
    val estimates = combine(householdFeatures.categoryRows.map { rows -> rows.map { com.household.budget.data.local.CategoryEntity(it.id, it.name, it.active, it.revision, null) } }, acceptedEstimates, cachedSuggestions) { cats, values, suggestions ->
        planRowsFromCache(cats, values, suggestions)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())
    val savingsTarget = combine(graph.database, selectedMonth) { db, month -> db to month }
        .flatMapLatest { (db, month) -> db.budgetDao().observePlan(month.toString()) }
        .map { it?.savingsTargetCents }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val monthPlan = combine(graph.database, selectedMonth) { db, month -> db to month }
        .flatMapLatest { (db, month) ->
            combine(householdFeatures.categoryRows, db.budgetDao().observeEstimates(month.toString()),
                db.budgetDao().observeCaches("suggestion:$month:"), db.budgetDao().observePlan(month.toString())) { cats, values, documents, plan ->
                val suggestions = documents.mapNotNull { runCatching {
                    com.household.budget.household.HouseholdActions.parseSuggestion(it.payloadJson)
                }.getOrNull() }
                MonthPlanState(month, planRowsFromCache(cats.map { com.household.budget.data.local.CategoryEntity(it.id, it.name, it.active, it.revision, null) }, values, suggestions), plan?.savingsTargetCents)
            }
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), MonthPlanState(selectedMonth.value))
    val previousDashboard = combine(graph.database, selectedMonth) { db, month -> db to month }
        .flatMapLatest { (db, month) -> db.budgetDao().observeMonthSnapshot(month.minusMonths(1).toString()).map { month to it } }
        .combine(household) { (month, snapshot), home -> dashboardFromCache(home, month.minusMonths(1), snapshot, graph.clock.instant()) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), dashboardFromCache(null, selectedMonth.value.minusMonths(1), null, graph.clock.instant()))

    fun saveEstimate(categoryId: String, amountCents: Long) {
        session.mutate(selectedMonth.value, action = {
            graph.queueEstimate(selectedMonth.value, categoryId, amountCents)
        }, onStored = {})
    }

    fun acceptSuggestion(categoryId: String) {
        estimates.value.firstOrNull { it.categoryId == categoryId }?.suggestedCents
            ?.let { saveEstimate(categoryId, it) }
    }

    fun saveSavingsTarget(amountCents: Long?) {
        session.mutate(selectedMonth.value, action = {
            graph.queueSavingsTarget(selectedMonth.value, amountCents)
        }, onStored = {})
    }

    val conflicts = graph.database.flatMapLatest { it.budgetDao().observeConflicts() }
        .map { rows -> rows.map { com.household.budget.ui.ConflictRow(it.id, it.entityType,
            it.entityId, it.serverValueJson, it.proposedValueJson) } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun deleteEntry(id: String) {
        session.mutate(selectedMonth.value, action = { graph.deleteEntry(id) }, onStored = {})
    }

    fun resolveConflict(id: String, choice: com.household.budget.ui.ConflictChoice) {
        session.mutate(selectedMonth.value, action = {
            graph.repository().resolveConflict(id, choice.wireValue)
        }, onStored = {})
    }

    init {
        viewModelScope.launch { graph.syncEnabled.collect { enabled ->
            if (!enabled && graph.credentials.load() != null) session.markRevoked()
        } }
        if (graph.credentials.load() != null) session.refresh(selectedMonth.value)
    }

    fun selectMonth(month: YearMonth) {
        selectedMonth.value = month
        session.refresh(month)
    }

    fun saveEntry(draft: EntryDraft, id: String? = null, revision: Long = 0, onSaved: () -> Unit) {
        session.mutate(selectedMonth.value, action = { graph.queueEntry(draft, id, revision) }, onStored = onSaved)
    }
}
