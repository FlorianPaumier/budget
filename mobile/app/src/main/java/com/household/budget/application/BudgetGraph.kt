package com.household.budget.application

import android.content.Context
import androidx.room.Room
import com.household.budget.data.local.BudgetDatabase
import com.household.budget.data.local.MIGRATION_1_2
import com.household.budget.data.local.MIGRATION_2_3
import com.household.budget.data.remote.BudgetApi
import com.household.budget.data.repository.BudgetGateway
import com.household.budget.data.repository.BudgetRepository
import com.household.budget.security.PairingCredentialStore
import com.household.budget.security.PairingStore
import com.household.budget.security.PairedDevice
import com.household.budget.ui.EntryDraft
import com.household.budget.ui.entryDraftToJson
import com.household.budget.work.SyncWorkScheduler
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.withContext
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.time.Clock
import java.time.LocalDate
import java.time.ZoneId
import java.time.YearMonth
import java.util.UUID

/** Application-owned dependencies keep Room and the sync mutex shared by screens and workers. */
class BudgetGraph(
    private val context: Context,
    val credentials: PairingCredentialStore = PairingStore(context),
    val api: BudgetApi = BudgetApi(credentials),
    val clock: Clock = Clock.systemUTC(),
    private val databaseFactory: (String) -> BudgetDatabase = { id ->
        Room.databaseBuilder(context, BudgetDatabase::class.java, "budget-$id.db")
            .addMigrations(MIGRATION_1_2, MIGRATION_2_3).build()
    },
    private val periodicSyncRegistration: () -> Unit = { SyncWorkScheduler.register(context) },
    private val immediateSyncEnqueue: () -> Unit = { SyncWorkScheduler.enqueueNow(context) },
) : BudgetSessionServices {
    suspend fun currentMonth(): YearMonth {
        val household = database.value.budgetDao().observeHousehold().first()
        val zone = ZoneId.of(household?.timeZone ?: "America/Toronto")
        return YearMonth.now(clock.withZone(zone))
    }

    fun startReminderWatch() = CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
        database.collectLatest { db ->
            com.household.budget.reminders.ReminderCoordinator(db, clock,
                com.household.budget.reminders.ReminderScheduler(context)::replace).watch(syncEnabled)
        }
    }

    private val accessPreferences = context.getSharedPreferences("sync-access", Context.MODE_PRIVATE)
    val syncEnabled = MutableStateFlow(credentials.load()?.let { !accessPreferences.getBoolean(it.deviceId, false) } ?: false)
    @Synchronized
    private fun pauseSync(device: PairedDevice) {
        accessPreferences.edit().putBoolean(device.deviceId, true).commit()
        if (credentials.load() == device) syncEnabled.value = false
    }

    @Synchronized
    private fun activatePairing(device: PairedDevice) {
        if (credentials.load() != device) return
        database.value = openDatabase(device.householdId)
        accessPreferences.edit().remove(device.deviceId).commit()
        syncEnabled.value = true
    }

    private val databases = mutableMapOf<String, BudgetDatabase>()
    private val repositories = mutableMapOf<com.household.budget.security.PairedDevice, BudgetRepository>()
    val database = MutableStateFlow(openDatabase(credentials.load()?.householdId ?: "unpaired"))

    init { if (credentials.load() != null) periodicSyncRegistration() }

    @Synchronized
    private fun openDatabase(householdId: String) = databases.getOrPut(householdId) { databaseFactory(householdId) }

    @Synchronized
    fun repository(): BudgetRepository = repository(checkNotNull(credentials.load()) { "Pair this phone first" })

    @Synchronized
    private fun repository(device: PairedDevice): BudgetRepository {
        return repositories.getOrPut(device) {
            BudgetRepository(openDatabase(device.householdId), BudgetGateway { method, path, body -> api.authenticatedAs(device, method, path, body) }, device.householdId)
        }
    }

    override suspend fun health(url: String): Boolean = withContext(Dispatchers.IO) { api.health(url) }

    override suspend fun pair(url: String, code: String, label: String): Unit = withContext(Dispatchers.IO) {
        val payload = BudgetApi.parsePairingPayload(code)
        val device = api.pair(payload.serverUrl ?: url, payload.pairingCode, label)
        activatePairing(device)
        periodicSyncRegistration()
        runCatching { immediateSyncEnqueue() }
        Unit
    }

    override suspend fun refresh(month: YearMonth) {
        check(syncEnabled.value) { "Access paused. Pair this phone again." }
        val device = checkNotNull(credentials.load()) { "Pair this phone first" }
        try {
            val db = openDatabase(device.householdId)
            val repository = repository(device)
            val generation = db.budgetDao().getCache("sync-generation")?.payloadJson
            repository.initialize()
            repository.syncOnce()
            if (generation != db.budgetDao().getCache("sync-generation")?.payloadJson) repository.initialize()
            val household = checkNotNull(db.budgetDao().observeHousehold().first())
            val today = LocalDate.now(clock.withZone(ZoneId.of(household.timeZone)))
            val asOf = when {
                month == YearMonth.from(today) -> today
                month < YearMonth.from(today) -> month.atEndOfMonth()
                else -> month.atDay(1)
            }
            repository.refreshMonth(month.toString(), asOf.toString())
            repository.refreshOccurrences(today.toString(), today.plusDays(60).toString(), today.toString())
            val actions = householdActions(device)
            for (category in db.budgetDao().observeCategories().first().filter { it.active }) {
                db.budgetDao().upsertCache(com.household.budget.data.local.CacheDocumentEntity(
                    "suggestion:${month}:${category.id}", withContext(Dispatchers.IO) { actions.suggestionJson(month.toString(), category.id) }))
            }
            db.budgetDao().upsertCache(com.household.budget.data.local.CacheDocumentEntity("last-sync", clock.instant().toString()))
        } catch (failure: com.household.budget.data.remote.ApiException) {
            if (failure.status == 401) pauseSync(device)
            throw failure
        }
    }

    suspend fun checkUpdate(): com.household.budget.updates.UpdateCheck = withContext(Dispatchers.IO) {
        com.household.budget.updates.UpdateDownload(credentials.load()?.baseUrl ?: BudgetApi.DEFAULT_HOME_URL,
            com.household.budget.BuildConfig.VERSION_CODE,
            context.resources.openRawResource(com.household.budget.R.raw.update_public_key).use { it.readBytes() },
            java.io.File(context.cacheDir, "updates")).check()
    }

    fun householdActions(): com.household.budget.household.HouseholdActions =
        householdActions(checkNotNull(credentials.load()))

    private fun householdActions(device: PairedDevice): com.household.budget.household.HouseholdActions {
        return com.household.budget.household.HouseholdActions(BudgetGateway { method, path, body ->
            try { api.authenticatedAs(device, method, path, body) }
            catch (failure: com.household.budget.data.remote.ApiException) {
                if (failure.status == 401) pauseSync(device)
                throw failure
            }
        })
    }

    suspend fun queueMutation(type: String, action: String, id: String, revision: Long, value: org.json.JSONObject? = null) {
        repository().queue(type, action, id, revision, value?.toString())
        runCatching { immediateSyncEnqueue() }
    }

    suspend fun queueReminderTime(hour: String) {
        require(Regex("^([01]\\d|2[0-3]):[0-5]\\d$").matches(hour)) { "Use HH:mm" }
        val home = checkNotNull(database.value.budgetDao().observeHousehold().first())
        queueMutation("household", "update", home.id, home.revision, org.json.JSONObject().put("reminderTime", hour))
    }

    private val planningQueueMutex = Mutex()

    suspend fun queueEstimate(month: YearMonth, categoryId: String, amountCents: Long) = planningQueueMutex.withLock {
        require(amountCents in 0..9007199254740991L) { "Estimate must be nonnegative safe integer cents" }
        val monthId = month.toString()
        val cached = database.value.budgetDao().observeEstimates(monthId).first()
            .firstOrNull { it.categoryId == categoryId }
        val pending = database.value.budgetDao().observePendingOperations().first().firstOrNull {
            it.entityType == "monthly_estimate" && it.state == "pending" && it.valueJson?.let { raw ->
                val json = org.json.JSONObject(raw)
                json.optString("month") == monthId && json.optString("categoryId") == categoryId
            } == true
        }
        val value = org.json.JSONObject()
            .put("month", monthId)
            .put("categoryId", categoryId)
            .put("amountCents", amountCents)
        repository().queue(
            "monthly_estimate", if (cached == null && pending == null) "create" else "update",
            cached?.id ?: pending?.entityId ?: UUID.randomUUID().toString(), cached?.revision ?: 0,
            value.toString(),
        )
        runCatching { immediateSyncEnqueue() }
        Unit
    }

    suspend fun queueSavingsTarget(month: YearMonth, targetCents: Long?) = planningQueueMutex.withLock {
        require(targetCents == null || targetCents in 0..9007199254740991L) { "Target must be nonnegative safe integer cents" }
        val monthId = month.toString()
        val cached = database.value.budgetDao().observePlan(monthId).first()
        val pending = database.value.budgetDao().observePendingOperations().first().firstOrNull {
            it.entityType == "monthly_plan" && it.state == "pending" && it.valueJson?.let { raw ->
                org.json.JSONObject(raw).optString("month") == monthId
            } == true
        }
        val value = org.json.JSONObject()
            .put("month", monthId)
            .put("savingsTargetCents", targetCents ?: org.json.JSONObject.NULL)
        repository().queue(
            "monthly_plan", if (cached == null && pending == null) "create" else "update",
            cached?.id ?: pending?.entityId ?: UUID.randomUUID().toString(), cached?.revision ?: 0,
            value.toString(),
        )
        runCatching { immediateSyncEnqueue() }
        Unit
    }

    suspend fun deleteEntry(id: String) {
        val entry = checkNotNull(database.value.budgetDao().getEntry(id)) { "Entry is not cached" }
        require(entry.occurrenceId == null) { "Correct this entry through its recurring occurrence" }
        repository().queue("ledger_entry", "delete", id, entry.revision, null)
        runCatching { immediateSyncEnqueue() }
        Unit
    }

    suspend fun queueEntry(draft: EntryDraft, id: String? = null, revision: Long = 0) {
        repository().queue("ledger_entry", if (id == null) "create" else "update",
            id ?: UUID.randomUUID().toString(), revision, entryDraftToJson(draft).apply {
                if (id != null) {
                    put("categoryId", draft.categoryId ?: org.json.JSONObject.NULL)
                    put("note", draft.note.takeIf { it.isNotEmpty() } ?: org.json.JSONObject.NULL)
                }
            }.toString())
        runCatching { immediateSyncEnqueue() }
        Unit
    }
}
