package com.household.budget.application

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.household.budget.data.local.BudgetDatabase
import com.household.budget.data.remote.BudgetApi
import com.household.budget.security.PairedDevice
import com.household.budget.security.PairingCredentialStore
import com.household.budget.ui.EntryDraft
import com.household.budget.ui.EntryKind
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import java.util.concurrent.CyclicBarrier
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.After
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class BudgetGraphTest {
    private val databases = mutableMapOf<String, BudgetDatabase>()
    private val context: Context = ApplicationProvider.getApplicationContext()
    private val store = MemoryCredentials(PairedDevice("https://budget.home.arpa", "device", "old-home", "secret"))
    private fun graph(): BudgetGraph {
        val client = OkHttpClient.Builder().addInterceptor { chain ->
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(200).message("OK")
                .body("""{"data":{"deviceId":"new-device","householdId":"new-home","credential":"new-secret"}}""".toResponseBody()).build()
        }.build()
        return BudgetGraph(context, store, BudgetApi(store, client), databaseFactory = { household ->
            databases.getOrPut(household) { Room.inMemoryDatabaseBuilder(context, BudgetDatabase::class.java).build() }
        }, periodicSyncRegistration = {}, immediateSyncEnqueue = {})
    }
    @After fun closeDatabases() { databases.values.forEach { it.close() } }
    @Test fun `entry is saved to pending queue before any sync attempt`() = runBlocking {
        val graph = graph()
        graph.queueEntry(EntryDraft(EntryKind.INCOME, "2026-10-05", "12.50"))
        val pending = graph.database.value.budgetDao().pendingBatch()
        assertEquals(1, pending.size)
        assertEquals("ledger_entry", pending.single().entityType)
        assertEquals(1250L, org.json.JSONObject(pending.single().valueJson!!).getLong("amountCents"))
    }
    @Test fun `existing pairing registers background sync at graph startup`() {
        var registrations = 0
        BudgetGraph(context, store, databaseFactory = { id ->
            databases.getOrPut(id) { Room.inMemoryDatabaseBuilder(context, BudgetDatabase::class.java).build() }
        }, periodicSyncRegistration = { registrations++ }, immediateSyncEnqueue = {})
        assertEquals(1, registrations)
    }

    @Test fun `queued entry schedules sync only after durable local write`() = runBlocking {
        lateinit var graph: BudgetGraph
        var pendingAtEnqueue = -1
        graph = BudgetGraph(context, store, databaseFactory = { id ->
            databases.getOrPut(id) { Room.inMemoryDatabaseBuilder(context, BudgetDatabase::class.java).build() }
        }, periodicSyncRegistration = {}, immediateSyncEnqueue = {
            pendingAtEnqueue = runBlocking { graph.database.value.budgetDao().pendingBatch().size }
        })

        graph.queueEntry(EntryDraft(EntryKind.INCOME, "2026-10-05", "12.50"))

        assertEquals(1, pendingAtEnqueue)
    }

    @Test fun `scheduler failure does not report a durable edit as lost`() = runBlocking {
        val graph = BudgetGraph(context, store, databaseFactory = { id ->
            databases.getOrPut(id) { Room.inMemoryDatabaseBuilder(context, BudgetDatabase::class.java).build() }
        }, periodicSyncRegistration = {}, immediateSyncEnqueue = { throw IllegalStateException("Scheduler unavailable") })

        graph.queueEntry(EntryDraft(EntryKind.INCOME, "2026-10-05", "12.50"))

        assertEquals(1, graph.database.value.budgetDao().pendingBatch().size)
    }

    @Test fun `successful pairing registers and enqueues sync after credential storage`() = runBlocking {
        val client = OkHttpClient.Builder().addInterceptor { chain ->
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(201).message("Created")
                .body("""{"data":{"deviceId":"new-device","householdId":"new-home","credential":"new-secret"}}""".toResponseBody()).build()
        }.build()
        var registeredAfterPair = false
        var enqueuedAfterPair = false
        val graph = BudgetGraph(context, store, BudgetApi(store, client), databaseFactory = { id ->
            databases.getOrPut(id) { Room.inMemoryDatabaseBuilder(context, BudgetDatabase::class.java).build() }
        }, periodicSyncRegistration = { registeredAfterPair = store.load()?.householdId == "new-home" },
            immediateSyncEnqueue = { enqueuedAfterPair = store.load()?.householdId == "new-home" })

        graph.pair("https://budget.home.arpa", "0123456789abcdef0123456789abcdef", "Phone")

        assertTrue(registeredAfterPair)
        assertTrue(enqueuedAfterPair)
    }
    @Test fun `concurrent pairing opens one database for the new household`() = runBlocking {
        val client = OkHttpClient.Builder().addInterceptor { chain ->
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(201).message("Created")
                .body("""{"data":{"deviceId":"new-device","householdId":"new-home","credential":"new-secret"}}""".toResponseBody()).build()
        }.build()
        val newHomeOpens = AtomicInteger()
        val barrier = CyclicBarrier(2)
        val graph = BudgetGraph(context, store, BudgetApi(store, client), databaseFactory = { id ->
            if (id == "new-home") {
                newHomeOpens.incrementAndGet()
                runCatching { barrier.await(1, TimeUnit.SECONDS) }
            }
            Room.inMemoryDatabaseBuilder(context, BudgetDatabase::class.java).build().also { databases[id] = it }
        }, periodicSyncRegistration = {}, immediateSyncEnqueue = {})

        val first = async(Dispatchers.Default) {
            graph.pair("https://budget.home.arpa", "0123456789abcdef0123456789abcdef", "Phone A")
        }
        val second = async(Dispatchers.Default) {
            graph.pair("https://budget.home.arpa", "0123456789abcdef0123456789abcdef", "Phone B")
        }
        first.await()
        second.await()

        assertEquals(1, newHomeOpens.get())
    }
    @Test fun `pairing another household keeps its cache separate from prior unsynced work`() = runBlocking {
        val graph = graph()
        val oldDatabase = graph.database.value
        graph.queueEntry(EntryDraft(EntryKind.INCOME, "2026-10-05", "12.50"))
        graph.pair("https://budget.home.arpa", "0123456789abcdef0123456789abcdef", "Phone")
        assertNotSame(oldDatabase, graph.database.value)
        assertEquals(1, oldDatabase.budgetDao().pendingBatch().size)
        assertEquals(0, graph.database.value.budgetDao().pendingBatch().size)
    }
    @Test fun `refresh caches accepted figures using the household calendar date`() = runBlocking {
        val requested = mutableListOf<String>()
        val client = OkHttpClient.Builder().addInterceptor { chain ->
            requested += chain.request().url.encodedPath + "?" + chain.request().url.encodedQuery.orEmpty()
            val data = when (chain.request().url.encodedPath) {
                "/api/v1/household" -> """{"id":"old-home","currency":"CAD","timeZone":"America/Toronto","reminderTime":"09:00","openingSpendableCents":10000,"openingSavingsCents":1000,"openingDate":"2026-10-01","monthlySavingsTargetCents":null,"revision":1}"""
                "/api/v1/sync/changes" -> """{"changes":[],"nextCursor":0,"hasMore":false}"""
                "/api/v1/sync/conflicts" -> """{"conflicts":[]}"""
                "/api/v1/months/2026-10/plan" -> """{"month":"2026-10","openingSpendableCents":10000,"expectedIncomeCents":2500,"expectedBillsCents":0,"estimateCents":0,"savingsTargetCents":0,"moneyLeftCents":12500,"estimates":[],"savingsTarget":null}"""
                "/api/v1/months/2026-10/actuals" -> """{"incomeCents":0,"spendingCents":0,"transferToSavingsCents":0,"moneyLeftTodayCents":10000}"""
                "/api/v1/balances" -> """{"spendableCents":10000,"savingsCents":1000,"combinedCents":11000}"""
                else -> "[]"
            }
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(200).message("OK")
                .body("{\"data\":$data}".toResponseBody()).build()
        }.build()
        val graph = BudgetGraph(context, store, BudgetApi(store, client),
            clock = java.time.Clock.fixed(java.time.Instant.parse("2026-11-01T02:00:00Z"), java.time.ZoneOffset.UTC),
            databaseFactory = { id -> databases.getOrPut(id) { Room.inMemoryDatabaseBuilder(context, BudgetDatabase::class.java).build() } },
            periodicSyncRegistration = {}, immediateSyncEnqueue = {})
        graph.refresh(java.time.YearMonth.of(2026, 10))
        val cached = graph.database.value.budgetDao().getMonthSnapshot("2026-10")
        assertNotNull(cached)
        assertEquals("2026-10-31", cached?.asOf)
        assertTrue(requested.contains("/api/v1/balances?asOf=2026-10-31"))
    }
    @Test fun `entry update explicitly clears nullable fields and retains base revision`() = runBlocking {
        val graph = graph()
        val id = "11111111-1111-4111-8111-111111111111"
        graph.queueEntry(EntryDraft(EntryKind.INCOME, "2026-10-05", "12.50"), id, 7)
        val op = graph.database.value.budgetDao().pendingBatch().single()
        val json = org.json.JSONObject(op.valueJson!!)
        assertEquals(7L, op.baseRevision)
        assertTrue(json.has("categoryId") && json.isNull("categoryId"))
        assertTrue(json.has("note") && json.isNull("note"))
    }
    @Test fun `deletion queues the cached revision without deleting accepted entry`() = runBlocking {
        val graph = graph()
        val id = "11111111-1111-4111-8111-111111111111"
        val dao = graph.database.value.budgetDao()
        dao.upsertEntries(listOf(com.household.budget.data.local.LedgerEntryEntity(
            id, "income", "2026-10-05", 1250, null, null, null, null, 8, null)))
        graph.deleteEntry(id)
        val op = dao.pendingBatch().single()
        assertEquals("delete", op.action)
        assertEquals(8L, op.baseRevision)
        assertNotNull(dao.getEntry(id))
    }
    @Test fun `old household repository never sends requests with a newly paired credential`() = runBlocking {
        val sent = mutableListOf<String?>()
        val client = OkHttpClient.Builder().addInterceptor { chain ->
            sent += chain.request().header("Authorization")
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(200).message("OK")
                .body("""{"data":{"changes":[],"nextCursor":0,"hasMore":false,"conflicts":[]}}""".toResponseBody()).build()
        }.build()
        val graph = BudgetGraph(context, store, BudgetApi(store, client), databaseFactory = { id ->
            databases.getOrPut(id) { Room.inMemoryDatabaseBuilder(context, BudgetDatabase::class.java).build() }
        }, periodicSyncRegistration = {}, immediateSyncEnqueue = {})
        val old = graph.repository()
        store.save(PairedDevice("https://budget.home.arpa", "new-device", "new-home", "new-secret"))
        old.syncOnce()
        assertTrue(sent.isNotEmpty())
        assertTrue(sent.all { it == "Bearer secret" })
    }
    @Test fun `unauthorized refresh pauses sync and survives process recreation`() = runBlocking {
        val localStore = MemoryCredentials(PairedDevice("https://budget.home.arpa", "revoked-test", "old-home", "secret"))
        val client = OkHttpClient.Builder().addInterceptor { chain ->
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(401).message("Unauthorized")
                .body("""{"code":"unauthorized","message":"Revoked"}""".toResponseBody()).build()
        }.build()
        fun newGraph() = BudgetGraph(context, localStore, BudgetApi(localStore, client), databaseFactory = { id ->
            databases.getOrPut(id) { Room.inMemoryDatabaseBuilder(context, BudgetDatabase::class.java).build() }
        }, periodicSyncRegistration = {}, immediateSyncEnqueue = {})
        try {
            val graph = newGraph()
            runCatching { graph.refresh(java.time.YearMonth.of(2026, 10)) }
            assertFalse(graph.syncEnabled.value)
            assertFalse(newGraph().syncEnabled.value)
        } finally { context.getSharedPreferences("sync-access", Context.MODE_PRIVATE).edit().clear().commit() }
    }
    @Test fun `late unauthorized refresh cannot revoke a new pairing`() = runBlocking {
        lateinit var graph: BudgetGraph
        val client = OkHttpClient.Builder().addInterceptor { chain ->
            val pairing = chain.request().url.encodedPath.endsWith("/pair")
            if (!pairing) runBlocking {
                graph.pair("https://budget.home.arpa", "0123456789abcdef0123456789abcdef", "New phone")
            }
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1)
                .code(if (pairing) 201 else 401).message("Response")
                .body((if (pairing) """{"data":{"deviceId":"new-device","householdId":"new-home","credential":"new-secret"}}"""
                else """{"code":"unauthorized","message":"Revoked"}""").toResponseBody()).build()
        }.build()
        fun newGraph() = BudgetGraph(context, store, BudgetApi(store, client), databaseFactory = { id ->
            databases.getOrPut(id) { Room.inMemoryDatabaseBuilder(context, BudgetDatabase::class.java).build() }
        }, periodicSyncRegistration = {}, immediateSyncEnqueue = {})
        try {
            graph = newGraph()
            val result = runCatching { graph.refresh(java.time.YearMonth.of(2026, 10)) }
            assertTrue(result.exceptionOrNull() is com.household.budget.data.remote.ApiException)
            assertEquals("new-device", store.load()?.deviceId)
            assertTrue(graph.syncEnabled.value)
            assertTrue(newGraph().syncEnabled.value)
        } finally { context.getSharedPreferences("sync-access", Context.MODE_PRIVATE).edit().clear().commit() }
    }

    @Test fun `refresh keeps suggestions bound to its original household after pairing changes`() = runBlocking {
        lateinit var graph: BudgetGraph
        val authorizations = mutableListOf<String?>()
        val client = OkHttpClient.Builder().addInterceptor { chain ->
            val path = chain.request().url.encodedPath
            if (path == "/api/v1/pair") {
                Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(201).message("Created")
                    .body("""{"data":{"deviceId":"new-device","householdId":"new-home","credential":"new-secret"}}""".toResponseBody()).build()
            } else {
                authorizations += chain.request().header("Authorization")
                val data = when (path) {
                    "/api/v1/household" -> {
                        runBlocking { graph.pair("https://budget.home.arpa", "0123456789abcdef0123456789abcdef", "New phone") }
                        """{"id":"old-home","currency":"CAD","timeZone":"America/Toronto","reminderTime":"09:00","openingSpendableCents":10000,"openingSavingsCents":1000,"openingDate":"2026-10-01","monthlySavingsTargetCents":null,"revision":1}"""
                    }
                    "/api/v1/categories" -> """[{"id":"11111111-1111-4111-8111-111111111111","name":"Food","active":true,"sortOrder":0,"revision":1}]"""
                    "/api/v1/sync/changes" -> """{"changes":[],"nextCursor":0,"hasMore":false}"""
                "/api/v1/sync/conflicts" -> """{"conflicts":[]}"""
                    "/api/v1/months/2026-10/plan" -> """{"month":"2026-10","openingSpendableCents":10000,"expectedIncomeCents":2500,"expectedBillsCents":0,"estimateCents":0,"savingsTargetCents":0,"moneyLeftCents":12500,"estimates":[],"savingsTarget":null}"""
                    "/api/v1/months/2026-10/actuals" -> """{"incomeCents":0,"spendingCents":0,"transferToSavingsCents":0,"moneyLeftTodayCents":10000}"""
                    "/api/v1/balances" -> """{"spendableCents":10000,"savingsCents":1000,"combinedCents":11000}"""
                    "/api/v1/months/2026-10/suggestions/11111111-1111-4111-8111-111111111111" -> """{"categoryId":"11111111-1111-4111-8111-111111111111","month":"2026-10","amountCents":1000,"sampleCount":1}"""
                    else -> "[]"
                }
                Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(200).message("OK")
                    .body("{\"data\":$data}".toResponseBody()).build()
            }
        }.build()
        graph = BudgetGraph(context, store, BudgetApi(store, client), databaseFactory = { id ->
            databases.getOrPut(id) { Room.inMemoryDatabaseBuilder(context, BudgetDatabase::class.java).build() }
        }, periodicSyncRegistration = {}, immediateSyncEnqueue = {})
        val original = graph.database.value
        graph.refresh(java.time.YearMonth.of(2026, 10))
        assertEquals("new-home", store.load()?.householdId)
        assertTrue(authorizations.isNotEmpty())
        assertTrue(authorizations.all { it == "Bearer secret" })
        assertNotNull(original.budgetDao().getCache("suggestion:2026-10:11111111-1111-4111-8111-111111111111"))
        assertNull(graph.database.value.budgetDao().getCache("last-sync"))
    }

    @Test fun `old household action cannot revoke a new pairing`() = runBlocking {
        val client = OkHttpClient.Builder().addInterceptor { chain ->
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(401).message("Unauthorized")
                .body("""{"code":"unauthorized","message":"Revoked"}""".toResponseBody()).build()
        }.build()
        val graph = BudgetGraph(context, store, BudgetApi(store, client), databaseFactory = { id ->
            databases.getOrPut(id) { Room.inMemoryDatabaseBuilder(context, BudgetDatabase::class.java).build() }
        }, periodicSyncRegistration = {}, immediateSyncEnqueue = {})
        val oldActions = graph.householdActions()
        store.save(PairedDevice("https://budget.home.arpa", "new-device", "new-home", "new-secret"))
        try {
            assertTrue(runCatching { oldActions.invalidatePairing() }.isFailure)
            assertTrue(graph.syncEnabled.value)
        } finally { context.getSharedPreferences("sync-access", Context.MODE_PRIVATE).edit().clear().commit() }
    }

    private class MemoryCredentials(var value: PairedDevice?) : PairingCredentialStore {
        override fun load() = value
        override fun save(device: PairedDevice) { value = device }
    }
}
