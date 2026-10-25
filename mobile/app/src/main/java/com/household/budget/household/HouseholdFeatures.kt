package com.household.budget.household

import com.household.budget.application.BudgetGraph
import com.household.budget.application.BudgetSession
import com.household.budget.data.local.CacheDocumentEntity
import com.household.budget.data.local.PendingOperationEntity
import com.household.budget.data.remote.PairingCode
import java.time.YearMonth
import java.util.UUID
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import org.json.JSONObject

@OptIn(ExperimentalCoroutinesApi::class)
class HouseholdFeatures(private val graph: BudgetGraph, private val session: BudgetSession, private val selectedMonth: StateFlow<YearMonth>, private val scope: CoroutineScope) {
    val categoryRows: StateFlow<List<CategoryRow>> = graph.database.flatMapLatest { db ->
        combine(db.budgetDao().observeCategories(), db.budgetDao().observePendingOperations()) { rows, pending ->
            overlayCategories(rows.map { CategoryRow(it.id, it.name, it.active, it.revision) }, pending)
        }
    }.stateIn(scope, SharingStarted.Eagerly, emptyList())
    val deviceRows: StateFlow<List<PhoneRow>> = graph.database.flatMapLatest { db ->
        db.budgetDao().observeDevices().map { rows -> rows.map { PhoneRow(it.id, it.label, it.pairedAt, it.revokedAt) } }
    }.stateIn(scope, SharingStarted.Eagerly, emptyList())
    private val mutablePairing = MutableStateFlow<PairingCode?>(null)
    val pairing: StateFlow<PairingCode?> = mutablePairing
    private val mutableHistoryEntryId = MutableStateFlow<String?>(null)
    val historyEntryId: StateFlow<String?> = mutableHistoryEntryId
    val historyRows: StateFlow<List<HistoryRow>> = combine(graph.database, historyEntryId) { db, id -> db to id }.flatMapLatest { (db, id) ->
        if (id == null) flowOf(emptyList()) else db.budgetDao().observeCache("history:$id").map { cache ->
            cache?.let { runCatching { HouseholdActions.parseHistory(it.payloadJson) }.getOrDefault(emptyList()) } ?: emptyList()
        }
    }.stateIn(scope, SharingStarted.Eagerly, emptyList())
    val lastSync: StateFlow<String?> = graph.database.flatMapLatest { db ->
        db.budgetDao().observeCache("last-sync").map { it?.payloadJson }
    }.stateIn(scope, SharingStarted.Eagerly, null)
    private var expiry: Job? = null

    init {
        scope.launch {
            graph.database.drop(1).collect {
                expiry?.cancel(); mutablePairing.value = null; mutableHistoryEntryId.value = null
            }
        }
        scope.launch {
            session.state.collect { state ->
                if (!state.canEdit) { expiry?.cancel(); mutablePairing.value = null }
            }
        }
    }
    private fun mutate(action: suspend () -> Unit): Job = session.mutate(selectedMonth.value, action, {})
    private fun validatedName(raw: String): String = raw.trim().also { require(it.length in 1..120) { "Name must contain 1–120 characters" } }
    fun createCategory(name: String): Job = mutate {
        graph.queueMutation("category", "create", UUID.randomUUID().toString(), 0, JSONObject().put("name", validatedName(name)))
    }
    fun updateCategory(id: String, name: String, active: Boolean): Job = mutate {
        val cached = category(id)
        graph.queueMutation("category", "update", id, cached.revision, JSONObject().put("name", validatedName(name)).put("active", active))
    }
    fun deleteCategory(id: String): Job = mutate {
        val cached = category(id)
        graph.queueMutation("category", "delete", id, cached.revision)
    }
    private suspend fun category(id: String): CategoryRow {
        val dao = graph.database.value.budgetDao()
        val accepted = dao.observeCategories().first().map { CategoryRow(it.id, it.name, it.active, it.revision) }
        return checkNotNull(overlayCategories(accepted, dao.observePendingOperations().first()).find { it.id == id }) { "Category is not cached or queued" }
    }
    private fun overlayCategories(accepted: List<CategoryRow>, operations: List<PendingOperationEntity>): List<CategoryRow> {
        val result = accepted.associateByTo(linkedMapOf()) { it.id }
        operations.filter { it.entityType == "category" && it.state != "rejected" }.forEach { operation ->
            if (operation.action == "delete") result.remove(operation.entityId)
            else {
                val value = JSONObject(checkNotNull(operation.valueJson))
                val existing = result[operation.entityId]
                if (operation.action == "create" || existing != null) {
                    result[operation.entityId] = CategoryRow(operation.entityId,
                        value.optString("name", existing?.name.orEmpty()),
                        if (value.has("active")) value.getBoolean("active") else existing?.active ?: true,
                        existing?.revision ?: 0, pending = true)
                }
            }
        }
        return result.values.sortedBy { it.name.lowercase() }
    }
    fun renamePhone(id: String, label: String): Job = mutate {
        withContext(Dispatchers.IO) { graph.householdActions().renamePhone(id, label) }
    }
    fun revokePhone(id: String): Job = mutate {
        withContext(Dispatchers.IO) { graph.householdActions().revokePhone(id) }
    }
    fun createPairing(): Job = mutate {
        val code = withContext(Dispatchers.IO) { graph.householdActions().createPairing() }
        expiry?.cancel(); mutablePairing.value = code
        expiry = scope.launch { delay(code.expiresInSeconds.toLong() * 1000); mutablePairing.value = null }
    }
    fun invalidatePairing(): Job = mutate {
        withContext(Dispatchers.IO) { graph.householdActions().invalidatePairing() }
        expiry?.cancel(); mutablePairing.value = null
    }
    fun showHistory(id: String): Job {
        mutableHistoryEntryId.value = id
        return mutate {
            val db = graph.database.value
            val raw = withContext(Dispatchers.IO) { graph.householdActions().historyJson(id) }
            db.budgetDao().upsertCache(CacheDocumentEntity("history:$id", raw))
        }
    }
    fun closeHistory() { mutableHistoryEntryId.value = null }
}
