package com.household.budget.recurring

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.household.budget.application.*
import com.household.budget.data.local.BudgetDatabase
import com.household.budget.security.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.time.YearMonth

@RunWith(RobolectricTestRunner::class)
class RecurringFeaturesTest {
    @Test fun creatingRulePersistsOfflineOperationWithStableIdAndExactPayload() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val db = Room.inMemoryDatabaseBuilder(context, BudgetDatabase::class.java).build()
        val store = object: PairingCredentialStore {
            override fun load() = PairedDevice("https://budget.home.arpa", "phone", "home", "secret")
            override fun save(device: PairedDevice) {}
        }
        val graph = BudgetGraph(context, store, databaseFactory = { db }, periodicSyncRegistration = {}, immediateSyncEnqueue = {})
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
        val offline = object: BudgetSessionServices {
            override suspend fun pair(url: String, code: String, label: String) {}
            override suspend fun health(url: String) = false
            override suspend fun refresh(month: YearMonth) { throw java.io.IOException("Offline") }
        }
        try {
            val features = RecurringFeatures(graph, BudgetSession(offline, scope, true), MutableStateFlow(YearMonth.of(2026,10)), scope)
            features.saveRule(RecurringDraft("Rent", amountCad = "1250.25", startsOn = "2026-10-31"), null, 0)
            val ops = withTimeoutOrNull(750) { db.budgetDao().observePendingOperations().first { it.isNotEmpty() } }
            assertNotNull("New rule must be durably queued while offline", ops)
            val op = ops!!.single()
            assertEquals("recurring_rule", op.entityType)
            assertEquals("create", op.action)
            assertEquals(0L, op.baseRevision)
            java.util.UUID.fromString(op.entityId)
            val json = org.json.JSONObject(op.valueJson!!)
            assertEquals(125025L, json.getLong("amountCents"))
            assertFalse(json.has("active"))
        } finally { scope.cancel(); db.close() }
    }
}
