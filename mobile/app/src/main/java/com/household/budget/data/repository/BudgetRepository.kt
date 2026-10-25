package com.household.budget.data.repository

import androidx.room.withTransaction
import com.household.budget.data.local.BudgetDatabase
import com.household.budget.data.local.CategoryEntity
import com.household.budget.data.local.HouseholdEntity
import com.household.budget.data.local.LedgerEntryEntity
import com.household.budget.data.local.DeviceEntity
import com.household.budget.data.local.MonthSnapshotEntity
import com.household.budget.data.local.MonthlyEstimateEntity
import com.household.budget.data.local.MonthlyPlanEntity
import com.household.budget.data.local.OccurrenceEntity
import com.household.budget.data.local.PendingOperationEntity
import com.household.budget.data.local.RecurringRuleEntity
import com.household.budget.data.local.SyncConflictEntity
import com.household.budget.data.local.SyncStateEntity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

fun interface BudgetGateway {
    /** Returns the full API JSON envelope. This blocking call is invoked off the main thread. */
    fun request(method: String, path: String, body: JSONObject?): JSONObject
}

class BudgetRepository(
    private val database: BudgetDatabase,
    private val gateway: BudgetGateway,
    private val householdId: String,
) {
    private val dao = database.budgetDao()
    private val syncMutex = SYNC_MUTEXES.computeIfAbsent(householdId) { Mutex() }

    /** Commits an operation before any network attempt and returns its stable retry ID. */
    suspend fun queue(
        entityType: String,
        action: String,
        entityId: String,
        baseRevision: Long,
        valueJson: String?,
    ): String {
        require(entityType in ENTITY_ACTIONS) { "Unsupported entity type" }
        require(action in ENTITY_ACTIONS.getValue(entityType)) { "Unsupported action for $entityType" }
        require(runCatching { UUID.fromString(entityId).toString() == entityId.lowercase() }.getOrDefault(false)) {
            "Entity ID must be a canonical UUID"
        }
        require(baseRevision >= 0) { "Negative revision" }
        require(action != "create" || baseRevision == 0L) { "Create must use revision zero" }
        require(action == "create" || baseRevision > 0 || dao.countPendingForEntity(entityId) > 0) {
            "Update/delete needs a known revision or prior queued operation"
        }
        require((action == "delete") == (valueJson == null)) { "Delete has no value; create/update require value" }
        if (valueJson != null) JSONObject(valueJson)
        val operationId = UUID.randomUUID().toString()
        dao.upsertPending(
            PendingOperationEntity(
                operationId = operationId,
                entityId = entityId,
                entityType = entityType,
                action = action,
                baseRevision = baseRevision,
                valueJson = valueJson,
                createdAt = Instant.now().toString(),
            ),
        )
        return operationId
    }

    /** Seeds small reference lists immediately after pairing; change feed keeps them current afterward. */
    suspend fun initialize() = withContext(Dispatchers.IO) {
        val household = gateway.request("GET", "/api/v1/household", null).getJSONObject("data")
        val categories = gateway.request("GET", "/api/v1/categories", null).getJSONArray("data")
        val rules = gateway.request("GET", "/api/v1/recurring-rules", null).getJSONArray("data")
        val devices = gateway.request("GET", "/api/v1/devices", null).getJSONArray("data")
        database.withTransaction {
            dao.upsertHousehold(HouseholdEntity(
                household.getString("id"), household.getString("currency"), household.getString("timeZone"),
                household.getString("reminderTime"), household.getLong("openingSpendableCents"),
                household.getLong("openingSavingsCents"), household.getString("openingDate"),
                household.longOrNull("monthlySavingsTargetCents"), household.getLong("revision"),
            ))
            dao.upsertCategories((0 until categories.length()).map { i ->
                val value = categories.getJSONObject(i)
                CategoryEntity(value.getString("id"), value.getString("name"), value.optBoolean("active", true),
                    value.getLong("revision"), value.stringOrNull("deletedAt"))
            })
            dao.upsertRules((0 until rules.length()).map { i ->
                val value = rules.getJSONObject(i)
                RecurringRuleEntity(value.getString("id"), value.getString("kind"), value.getString("name"),
                    value.stringOrNull("categoryId"), value.getLong("amountCents"), value.getString("frequency"),
                    value.getInt("interval"), value.getString("startsOn"), value.stringOrNull("endsOn"),
                    value.optJSONObject("scheduleDetails")?.toString(), value.optBoolean("active", true),
                    value.getLong("revision"), value.stringOrNull("deletedAt"))
            })
            dao.upsertDevices((0 until devices.length()).map { i ->
                val value = devices.getJSONObject(i)
                DeviceEntity(value.getString("id"), value.getString("label"), value.getString("pairedAt"),
                    value.stringOrNull("revokedAt"))
            })
        }
    }

    /** Stores a consistent server refresh for offline dashboard and list rendering. */
    suspend fun refreshMonth(month: String, today: String) = withContext(Dispatchers.IO) {
        val yearMonth = YearMonth.parse(month)
        require(today.startsWith(month)) { "Today must fall in requested month" }
        val from = yearMonth.atDay(1).toString()
        val through = yearMonth.atEndOfMonth().toString()
        val plan = gateway.request("GET", "/api/v1/months/$month/plan", null).getJSONObject("data")
        val actuals = gateway.request("GET", "/api/v1/months/$month/actuals?today=$today", null).getJSONObject("data")
        val balances = gateway.request("GET", "/api/v1/balances?asOf=$today", null).getJSONObject("data")
        val entries = gateway.request("GET", "/api/v1/entries?month=$month", null).getJSONArray("data")
        val occurrences = gateway.request("GET", "/api/v1/occurrences?from=$from&through=$through&today=$today", null).getJSONArray("data")
        database.withTransaction {
            dao.upsertMonthSnapshot(MonthSnapshotEntity(month, today, plan.toString(), actuals.toString(), balances.toString()))
            dao.upsertEntries((0 until entries.length()).map { i ->
                val value = entries.getJSONObject(i)
                LedgerEntryEntity(value.getString("id"), value.getString("kind"), value.getString("entryDate"),
                    value.getLong("amountCents"), value.stringOrNull("categoryId"), value.stringOrNull("account"),
                    value.stringOrNull("note"), value.stringOrNull("occurrenceId"), value.getLong("revision"),
                    value.stringOrNull("deletedAt"))
            })
            dao.upsertOccurrences((0 until occurrences.length()).map { i ->
                val value = occurrences.getJSONObject(i)
                OccurrenceEntity(value.getString("id"), value.getString("ruleId"), value.getString("ruleName"),
                    value.getString("ruleKind"), value.getString("expectedDate"), value.getLong("expectedAmountCents"),
                    value.getString("status"), value.stringOrNull("actualDate"), value.longOrNull("actualAmountCents"),
                    value.stringOrNull("confirmationMethod"), value.getBoolean("needsReview"), value.getLong("revision"),
                    value.stringOrNull("deletedAt"))
            })
        }
    }

    /** Refreshes an arbitrary reminder window; all accepted occurrences remain readable offline. */
    suspend fun refreshOccurrences(from: String, through: String, today: String) = withContext(Dispatchers.IO) {
        require(!LocalDate.parse(from).isAfter(LocalDate.parse(through))) { "Invalid occurrence range" }
        LocalDate.parse(today)
        val occurrences = gateway.request(
            "GET", "/api/v1/occurrences?from=$from&through=$through&today=$today", null,
        ).getJSONArray("data")
        database.withTransaction {
            dao.upsertOccurrences((0 until occurrences.length()).map { i ->
                val value = occurrences.getJSONObject(i)
                OccurrenceEntity(value.getString("id"), value.getString("ruleId"), value.getString("ruleName"),
                    value.getString("ruleKind"), value.getString("expectedDate"), value.getLong("expectedAmountCents"),
                    value.getString("status"), value.stringOrNull("actualDate"), value.longOrNull("actualAmountCents"),
                    value.stringOrNull("confirmationMethod"), value.getBoolean("needsReview"), value.getLong("revision"),
                    value.stringOrNull("deletedAt"))
            })
        }
    }

    /** Keeps both candidates until the server confirms a user's explicit choice. */
    suspend fun resolveConflict(id: String, choice: String) = syncMutex.withLock {
        require(choice == "server" || choice == "proposed") { "Invalid conflict choice" }
        withContext(Dispatchers.IO) {
            val conflict = dao.getConflict(id) ?: error("Conflict not cached: $id")
            val body = JSONObject().put("choice", choice)
            val generation = dao.getCache("sync-generation")?.payloadJson
            generation?.let { body.put("generation", it) }
            body.put("serverRevision", conflict.serverValueJson?.let { JSONObject(it).getLong("revision") } ?: JSONObject.NULL)
            val result = try {
                gateway.request("POST", "/api/v1/sync/conflicts/$id/resolve", body).getJSONObject("data")
            } catch (failure: com.household.budget.data.remote.ApiException) {
                if (failure.status == 409) {
                    // Preserve the proposal and show the latest candidate before another explicit choice.
                    try { refreshConflicts(reconcile = false) }
                    catch (cancelled: kotlinx.coroutines.CancellationException) { throw cancelled }
                    catch (refreshFailure: Exception) { failure.addSuppressed(refreshFailure) }
                }
                throw failure
            }
            require(result.getString("id") == id && result.getString("choice") in setOf("server", "proposed") && result.getString("status") == "resolved") {
                "Unexpected conflict resolution response"
            }
            pullAll()
            if (generation != dao.getCache("sync-generation")?.payloadJson)
                throw java.io.IOException("Le serveur a été restauré. Vos modifications sont conservées pour révision.")
            database.withTransaction { finishConflict(conflict) }
        }
    }

    /** Pushes queued edits, then applies every change page with its cursor in one Room transaction. */
    suspend fun syncOnce() = syncMutex.withLock {
        withContext(Dispatchers.IO) {
            pullAll()
            database.withTransaction {
                dao.retryTemporaryFailureDependents()
                dao.retryTemporaryFailures()
            }
            refreshConflicts()
            database.withTransaction {
                val operations = dao.observePendingOperations().first()
                for (blocked in operations.filter { it.state == "blocked" }.distinctBy { it.entityId }) {
                    if (operations.none { it.entityId == blocked.entityId && it.state in setOf("conflict", "rejected") })
                        resumeBlocked(blocked.entityType, blocked.entityId, blocked.entityId, blocked.valueJson)
                }
            }
            pushPending()
            pullAll()
            refreshConflicts()
        }
    }

    private suspend fun pushPending() {
        while (true) {
            // Only the earliest edit to an entity may be sent until its accepted revision is known.
            val batch = dao.pendingBatch(100).distinctBy { it.entityId }
            if (batch.isEmpty()) return
            val operations = JSONArray()
            batch.forEach { operation ->
                operations.put(JSONObject().apply {
                    put("operationId", operation.operationId)
                    put("entityId", operation.entityId)
                    put("entityType", operation.entityType)
                    put("action", operation.action)
                    put("baseRevision", operation.baseRevision)
                    if (operation.valueJson != null) put("value", JSONObject(operation.valueJson))
                })
            }
            val body = JSONObject().put("operations", operations)
            dao.getCache("sync-generation")?.let { body.put("generation", it.payloadJson) }
            val outcomes = gateway.request("POST", "/api/v1/sync/push", body)
                .getJSONObject("data").getJSONArray("outcomes")
            val byId = batch.associateBy { it.operationId }
            val seen = mutableSetOf<String>()
            database.withTransaction {
                for (index in 0 until outcomes.length()) {
                    val outcome = outcomes.getJSONObject(index)
                    val id = outcome.getString("operationId")
                    require(id in byId && seen.add(id)) { "Unexpected or repeated sync outcome" }
                    val status = outcome.getString("status")
                    when (if (status == "duplicate" && !outcome.isNull("conflictId")) "conflict" else status) {
                        "accepted", "duplicate" -> {
                            dao.deletePending(id)
                            if (dao.countPendingForEntity(byId.getValue(id).entityId) > 0) {
                                require(!outcome.isNull("revision")) { "Missing revision for dependent operation" }
                                dao.rebasePendingEntity(byId.getValue(id).entityId, outcome.getLong("revision"))
                            }
                        }
                        "conflict" -> {
                            dao.setPendingState(id, "conflict", null)
                            dao.blockPendingEntity(byId.getValue(id).entityId)
                            dao.upsertConflicts(listOf(SyncConflictEntity(
                                outcome.getString("conflictId"), byId.getValue(id).entityType, byId.getValue(id).entityId,
                                outcome.optJSONObject("serverValue")?.toString(), operations.getJSONObject(batch.indexOf(byId.getValue(id))).toString(),
                                Instant.now().toString(),
                            )))
                        }
                        "rejected" -> {
                            if (outcome.optString("code") == "OPERATION_FAILED")
                                throw java.io.IOException("Le serveur n’a pas pu enregistrer la modification. Réessayez.")
                            dao.setPendingState(id, "rejected", outcome.optString("code").ifEmpty { null })
                            dao.blockPendingEntity(byId.getValue(id).entityId)
                        }
                        else -> error("Unknown sync outcome")
                    }
                }
                require(seen.size == batch.size) { "Missing sync outcomes" }
            }
        }
    }

    private suspend fun refreshConflicts(reconcile: Boolean = true) {
        val conflicts = gateway.request("GET", "/api/v1/sync/conflicts", null)
            .getJSONObject("data").getJSONArray("conflicts")
        val mapped = (0 until conflicts.length()).map { index ->
            val value = conflicts.getJSONObject(index)
            SyncConflictEntity(
                id = value.getString("id"),
                entityType = value.getString("entityType"),
                entityId = value.getString("entityId"),
                serverValueJson = value.optJSONObject("serverValue")?.toString(),
                proposedValueJson = value.getJSONObject("proposedValue").toString(),
                createdAt = value.getString("createdAt"),
            )
        }
        database.withTransaction {
            if (reconcile) {
                val openIds = mapped.map { it.id }.toSet()
                for (cached in dao.observeConflicts().first().filter { it.id !in openIds }) finishConflict(cached)
            }
            dao.upsertConflicts(mapped)
        }
    }

    private suspend fun finishConflict(conflict: SyncConflictEntity) {
        val operationId = JSONObject(conflict.proposedValueJson).getString("operationId")
        if (dao.getPending(operationId) == null) {
            dao.deleteConflict(conflict.id)
            return
        }
        val targetId = conflict.serverValueJson?.let { JSONObject(it).optString("id", conflict.entityId) } ?: conflict.entityId
        dao.deleteConflict(conflict.id)
        dao.deletePending(operationId)
        resumeBlocked(conflict.entityType, conflict.entityId, targetId, JSONObject(conflict.proposedValueJson).optJSONObject("value")?.toString())
    }

    private suspend fun resumeBlocked(type: String, entityId: String, targetId: String, valueJson: String?) {
        val value = valueJson?.let(::JSONObject)
        val estimate = if (type == "monthly_estimate") dao.getEstimate(targetId) ?: value?.let {
            dao.observeEstimates(it.getString("month")).first().firstOrNull { row -> row.categoryId == it.getString("categoryId") }
        } else null
        val plan = if (type == "monthly_plan") dao.getPlan(targetId) ?: value?.let {
            dao.observePlan(it.getString("month")).first()
        } else null
        val revision = when (type) {
            "category" -> dao.getCategory(targetId)?.takeIf { it.deletedAt == null }?.revision
            "ledger_entry" -> dao.getEntry(targetId)?.takeIf { it.deletedAt == null }?.revision
            "recurring_rule" -> dao.getRule(targetId)?.takeIf { it.deletedAt == null }?.revision
            "occurrence" -> dao.getOccurrence(targetId)?.takeIf { it.deletedAt == null }?.revision
            "monthly_estimate" -> estimate?.takeIf { it.deletedAt == null }?.revision
            "monthly_plan" -> plan?.takeIf { it.deletedAt == null }?.revision
            "household" -> dao.getHousehold(targetId)?.revision
            else -> error("Unsupported conflict type")
        }
        if (revision == null) dao.rejectBlockedEntity(entityId)
        else dao.releasePendingEntity(entityId, estimate?.id ?: plan?.id ?: targetId, revision)
    }

    private suspend fun pullAll() {
        while (true) {
            val cursor = dao.syncState(householdId)?.cursor ?: "0"
            val data = gateway.request("GET", "/api/v1/sync/changes?cursor=$cursor&limit=100", null)
                .getJSONObject("data")
            val generation = data.optString("generation").takeIf { it.isNotEmpty() }
            if (generation != null && generation != dao.getCache("sync-generation")?.payloadJson) {
                database.withTransaction {
                    for (table in listOf("household", "categories", "ledger_entries", "monthly_estimates", "monthly_plans",
                        "recurring_rules", "occurrences", "devices", "month_snapshots", "sync_conflicts", "cache_documents")) {
                        database.openHelper.writableDatabase.execSQL("DELETE FROM $table")
                    }
                    dao.resetPendingAfterRestore()
                    dao.upsertSyncState(SyncStateEntity(householdId, "0"))
                    dao.upsertCache(com.household.budget.data.local.CacheDocumentEntity("sync-generation", generation))
                }
                continue
            }
            val changes = data.getJSONArray("changes")
            val nextCursor = data.getLong("nextCursor").toString()
            val hasMore = data.getBoolean("hasMore")
            require(!hasMore || nextCursor.toLong() > cursor.toLong()) { "Non-progressing sync page" }
            database.withTransaction {
                for (index in 0 until changes.length()) applyChange(changes.getJSONObject(index))
                dao.upsertSyncState(SyncStateEntity(householdId, nextCursor))
            }
            if (!hasMore) return
        }
    }

    private suspend fun applyChange(change: JSONObject) {
        val type = change.getString("entityType")
        val id = change.getString("entityId")
        val revision = if (change.isNull("revision")) 0 else change.getLong("revision")
        if (change.getBoolean("deleted")) {
            val deletedAt = Instant.now().toString()
            when (type) {
                "category" -> dao.tombstoneCategory(id, revision, deletedAt)
                "ledger_entry" -> dao.tombstoneEntry(id, revision, deletedAt)
                "monthly_estimate" -> dao.tombstoneEstimate(id, revision, deletedAt)
                "monthly_plan" -> dao.tombstonePlan(id, revision, deletedAt)
                "recurring_rule" -> dao.tombstoneRule(id, revision, deletedAt)
                "occurrence" -> dao.tombstoneOccurrence(id, revision, deletedAt)
                else -> error("Unsupported tombstone type $type")
            }
            return
        }
        val value = change.getJSONObject("value")
        when (type) {
            "category" -> dao.upsertCategories(listOf(CategoryEntity(id, value.getString("name"), value.optBoolean("active", true), revision, value.stringOrNull("deletedAt"))))
            "ledger_entry" -> dao.upsertEntries(listOf(LedgerEntryEntity(
                id, value.getString("kind"), value.getString("entryDate"), value.getLong("amountCents"),
                value.stringOrNull("categoryId"), value.stringOrNull("account"), value.stringOrNull("note"),
                value.stringOrNull("occurrenceId"), revision, value.stringOrNull("deletedAt"),
            )))
            "monthly_estimate" -> dao.upsertEstimates(listOf(MonthlyEstimateEntity(
                id, value.getString("categoryId"), value.getString("month"), value.getLong("amountCents"), revision, value.stringOrNull("deletedAt"),
            )))
            "monthly_plan" -> dao.upsertPlans(listOf(MonthlyPlanEntity(
                id, value.getString("month"), value.longOrNull("savingsTargetCents"), revision, value.stringOrNull("deletedAt"),
            )))
            "recurring_rule" -> dao.upsertRules(listOf(RecurringRuleEntity(
                id, value.getString("kind"), value.getString("name"), value.stringOrNull("categoryId"),
                value.getLong("amountCents"), value.getString("frequency"), value.getInt("interval"),
                value.getString("startsOn"), value.stringOrNull("endsOn"), value.optJSONObject("scheduleDetails")?.toString(),
                value.optBoolean("active", true), revision, value.stringOrNull("deletedAt"),
            )))
            "occurrence" -> {
                val ruleId = value.getString("ruleId")
                val rule = dao.getRule(ruleId)
                val existing = dao.getOccurrence(id)
                val ruleName = value.stringOrNull("ruleName") ?: rule?.name ?: existing?.ruleName ?: error("Occurrence rule missing from cache: $ruleId")
                val ruleKind = value.stringOrNull("ruleKind") ?: rule?.kind ?: existing?.ruleKind ?: error("Occurrence rule missing from cache: $ruleId")
                dao.upsertOccurrences(listOf(OccurrenceEntity(
                    id, ruleId, ruleName, ruleKind,
                    value.getString("expectedDate"), value.getLong("expectedAmountCents"), value.getString("status"),
                    value.stringOrNull("actualDate"), value.longOrNull("actualAmountCents"), value.stringOrNull("confirmationMethod"),
                    value.optBoolean("needsReview", false), revision, value.stringOrNull("deletedAt"),
                )))
            }
            "household" -> dao.upsertHousehold(HouseholdEntity(
                id, value.getString("currency"), value.getString("timeZone"), value.getString("reminderTime"),
                value.getLong("openingSpendableCents"), value.getLong("openingSavingsCents"), value.getString("openingDate"),
                value.longOrNull("monthlySavingsTargetCents"), revision,
            ))
            else -> error("Unsupported change type $type")
        }
    }

    private fun JSONObject.stringOrNull(key: String): String? = if (isNull(key)) null else getString(key)
    private fun JSONObject.longOrNull(key: String): Long? = if (isNull(key)) null else getLong(key)

    companion object {
        private val SYNC_MUTEXES = ConcurrentHashMap<String, Mutex>()
        private val ENTITY_ACTIONS = mapOf(
            "category" to setOf("create", "update", "delete"),
            "ledger_entry" to setOf("create", "update", "delete"),
            "recurring_rule" to setOf("create", "update", "delete"),
            "occurrence" to setOf("update"),
            "monthly_estimate" to setOf("create", "update"),
            "monthly_plan" to setOf("create", "update"),
            "household" to setOf("update"),
        )
    }
}
