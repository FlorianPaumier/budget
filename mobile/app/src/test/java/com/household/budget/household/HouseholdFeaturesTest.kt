package com.household.budget.household

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.household.budget.application.*
import com.household.budget.data.local.*
import com.household.budget.data.remote.BudgetApi
import com.household.budget.security.*
import java.io.IOException
import java.time.YearMonth
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class HouseholdFeaturesTest {
    private val context = ApplicationProvider.getApplicationContext<android.content.Context>()
    private val db = Room.inMemoryDatabaseBuilder(context, BudgetDatabase::class.java).build()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
    private val month = MutableStateFlow(YearMonth.of(2026, 10))
    private val store = object : PairingCredentialStore {
        override fun load() = PairedDevice("https://budget.home.arpa", "device", "home", "secret")
        override fun save(device: PairedDevice) {}
    }
    private val graph = BudgetGraph(context, store, BudgetApi(store), databaseFactory = { db }, periodicSyncRegistration = {}, immediateSyncEnqueue = {})
    private val services = object : BudgetSessionServices {
        override suspend fun health(url: String) = true
        override suspend fun pair(url: String, code: String, label: String) {}
        override suspend fun refresh(month: YearMonth) { throw IOException("Offline") }
    }
    @After fun close() { scope.cancel(); db.close() }
    @Test fun categoryIsDurablyQueuedBeforeRefreshFails() = runBlocking {
        val session = BudgetSession(services, scope, true)
        val features = HouseholdFeatures(graph, session, month, scope)
        features.createCategory(" Groceries ").join()
        val queued = db.budgetDao().pendingBatch().single()
        assertEquals("category", queued.entityType); assertEquals("create", queued.action)
        assertEquals("Groceries", JSONObject(queued.valueJson!!).getString("name"))
        assertEquals(ConnectionState.OFFLINE, session.state.value.connection)
    }
    @Test fun offlineCategoryAppearsAsPendingBeforeServerAcceptance() = runBlocking {
        val features = HouseholdFeatures(graph, BudgetSession(services, scope, true), month, scope)
        features.createCategory("Groceries").join()
        val rows = withTimeout(1000) { features.categoryRows.first { it.any { row -> row.name == "Groceries" } } }
        assertEquals(0L, rows.single().revision)
        features.updateCategory(rows.single().id, "Food", false).join()
        val edited = withTimeout(1000) { features.categoryRows.first { it.any { row -> row.name == "Food" } } }
        assertFalse(edited.single().active)
    }
    @Test fun pairingSecretIsRemovedAtExpiryEvenIfRefreshIsOffline() = runBlocking {
        val client = okhttp3.OkHttpClient.Builder().addInterceptor { chain ->
            okhttp3.Response.Builder().request(chain.request()).protocol(okhttp3.Protocol.HTTP_1_1).code(201).message("Created")
                .body(okhttp3.ResponseBody.create(null, """{"data":{"pairingCode":"secret","pairingUri":"budget://pair?code=secret","expiresInSeconds":1}}""")).build()
        }.build()
        val connectedGraph = BudgetGraph(context, store, BudgetApi(store, client), databaseFactory = { db }, periodicSyncRegistration = {}, immediateSyncEnqueue = {})
        val features = HouseholdFeatures(connectedGraph, BudgetSession(services, scope, true), month, scope)
        features.createPairing().join()
        assertNotNull(features.pairing.value)
        withTimeout(3000) { features.pairing.first { it == null } }
        assertNull(features.pairing.value)
    }
    @Test fun updateUsesCachedRevisionAndArchiveFlag() = runBlocking {
        db.budgetDao().upsertCategories(listOf(CategoryEntity("11111111-1111-4111-8111-111111111111", "Food", true, 7, null)))
        val features = HouseholdFeatures(graph, BudgetSession(services, scope, true), month, scope)
        features.updateCategory("11111111-1111-4111-8111-111111111111", "Food", false).join()
        val queued = db.budgetDao().pendingBatch().single()
        assertEquals(7L, queued.baseRevision); assertFalse(JSONObject(queued.valueJson!!).getBoolean("active"))
    }
    @Test fun cachedHistoryRemainsVisibleWhenOfflineAndCanBeClosed() = runBlocking {
        val id = "11111111-1111-4111-8111-111111111111"
        db.budgetDao().upsertCache(CacheDocumentEntity("history:$id", """{"data":[{"id":"event","deviceLabel":"Kitchen","createdAt":"2026-10-01","before":null,"after":{"amountCents":100}}]}"""))
        val session = BudgetSession(services, scope, false)
        val features = HouseholdFeatures(graph, session, month, scope)
        features.showHistory(id).join()
        val rows = withTimeout(5000) { features.historyRows.first { it.isNotEmpty() } }
        assertEquals("Kitchen", rows.single().deviceLabel)
        assertEquals(id, features.historyEntryId.value)
        features.closeHistory(); assertNull(features.historyEntryId.value)
    }
}
