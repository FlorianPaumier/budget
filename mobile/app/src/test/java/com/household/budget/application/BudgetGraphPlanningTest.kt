package com.household.budget.application

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.household.budget.data.local.BudgetDatabase
import com.household.budget.data.local.MonthlyEstimateEntity
import com.household.budget.data.local.MonthlyPlanEntity
import com.household.budget.data.remote.BudgetApi
import com.household.budget.security.PairedDevice
import com.household.budget.security.PairingCredentialStore
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.time.YearMonth
import java.util.UUID

@RunWith(RobolectricTestRunner::class)
class BudgetGraphPlanningTest {
    private val context: Context = ApplicationProvider.getApplicationContext()
    private val database = Room.inMemoryDatabaseBuilder(context, BudgetDatabase::class.java).build()
    private val householdId = "11111111-1111-4111-8111-111111111111"
    private val categoryId = "22222222-2222-4222-8222-222222222222"
    private val store = object : PairingCredentialStore {
        override fun load() = PairedDevice("https://budget.home.arpa", "phone", householdId, "secret")
        override fun save(device: PairedDevice) = Unit
    }
    private val graph = BudgetGraph(context, store, BudgetApi(store), databaseFactory = { database }, periodicSyncRegistration = {}, immediateSyncEnqueue = {})

    @After fun close() = database.close()

    @Test fun repeatedOfflineEstimateEditsReuseFirstQueuedResource() = runBlocking {
        graph.queueEstimate(YearMonth.of(2026, 10), categoryId, 1000)
        graph.queueEstimate(YearMonth.of(2026, 10), categoryId, 1250)

        val operations = database.budgetDao().pendingBatch()
        assertEquals(2, operations.size)
        assertEquals("create", operations[0].action)
        assertEquals("update", operations[1].action)
        assertEquals(operations[0].entityId, operations[1].entityId)
        assertEquals(0L, operations[1].baseRevision)
    }

    @Test fun repeatedOfflineSavingsEditsReuseFirstQueuedPlan() = runBlocking {
        graph.queueSavingsTarget(YearMonth.of(2026, 10), 2000)
        graph.queueSavingsTarget(YearMonth.of(2026, 10), 2500)

        val operations = database.budgetDao().pendingBatch()
        assertEquals(2, operations.size)
        assertEquals("create", operations[0].action)
        assertEquals("update", operations[1].action)
        assertEquals(operations[0].entityId, operations[1].entityId)
    }

    @Test fun negativeEstimateIsRejectedBeforeQueue() = runBlocking {
        var rejected = false
        try { graph.queueEstimate(YearMonth.of(2026, 10), categoryId, -1) }
        catch (_: IllegalArgumentException) { rejected = true }

        assertTrue(rejected)
        assertTrue(database.budgetDao().pendingBatch().isEmpty())
    }

    @Test fun unsafeSavingsTargetIsRejectedBeforeQueue() = runBlocking {
        var rejected = false
        try { graph.queueSavingsTarget(YearMonth.of(2026, 10), Long.MAX_VALUE) }
        catch (_: IllegalArgumentException) { rejected = true }

        assertTrue(rejected)
        assertTrue(database.budgetDao().pendingBatch().isEmpty())
    }

    @Test fun acceptedEstimateEditQueuesExistingIdAndRevision() = runBlocking {
        val id = "33333333-3333-4333-8333-333333333333"
        database.budgetDao().upsertEstimates(listOf(MonthlyEstimateEntity(id, categoryId, "2026-10", 1000, 5, null)))

        graph.queueEstimate(YearMonth.of(2026, 10), categoryId, 1250)

        val operation = database.budgetDao().pendingBatch().single()
        assertEquals("monthly_estimate", operation.entityType)
        assertEquals("update", operation.action)
        assertEquals(id, operation.entityId)
        assertEquals(5L, operation.baseRevision)
        assertEquals(1250L, JSONObject(operation.valueJson!!).getLong("amountCents"))
    }

    @Test fun firstEstimateQueuesCreateWithStableResourceId() = runBlocking {
        graph.queueEstimate(YearMonth.of(2026, 10), categoryId, 1250)

        val operation = database.budgetDao().pendingBatch().single()
        assertEquals("create", operation.action)
        assertEquals(0L, operation.baseRevision)
        UUID.fromString(operation.entityId)
        val value = JSONObject(operation.valueJson!!)
        assertEquals("2026-10", value.getString("month"))
        assertEquals(categoryId, value.getString("categoryId"))
    }

    @Test fun clearingSavingsTargetQueuesNullAgainstCachedPlanRevision() = runBlocking {
        val id = "44444444-4444-4444-8444-444444444444"
        database.budgetDao().upsertPlans(listOf(MonthlyPlanEntity(id, "2026-10", 5000, 3, null)))

        graph.queueSavingsTarget(YearMonth.of(2026, 10), null)

        val operation = database.budgetDao().pendingBatch().single()
        assertEquals("monthly_plan", operation.entityType)
        assertEquals("update", operation.action)
        assertEquals(id, operation.entityId)
        assertEquals(3L, operation.baseRevision)
        val value = JSONObject(operation.valueJson!!)
        assertEquals("2026-10", value.getString("month"))
        assertTrue(value.has("savingsTargetCents") && value.isNull("savingsTargetCents"))
    }

    @Test fun firstSavingsTargetQueuesCreateWithNewPlanId() = runBlocking {
        graph.queueSavingsTarget(YearMonth.of(2026, 10), 2500)

        val operation = database.budgetDao().pendingBatch().single()
        assertEquals("monthly_plan", operation.entityType)
        assertEquals("create", operation.action)
        assertEquals(0L, operation.baseRevision)
        UUID.fromString(operation.entityId)
        assertEquals(2500L, JSONObject(operation.valueJson!!).getLong("savingsTargetCents"))
    }
}
