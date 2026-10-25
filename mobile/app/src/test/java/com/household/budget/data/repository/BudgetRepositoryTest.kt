package com.household.budget.data.repository

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.household.budget.data.local.BudgetDatabase
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import org.json.JSONArray
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class BudgetRepositoryTest {
    private lateinit var database: BudgetDatabase
    private val householdId = "11111111-1111-4111-8111-111111111111"
    private val categoryId = "22222222-2222-4222-8222-222222222222"

    @Before fun createDatabase() {
        database = Room.inMemoryDatabaseBuilder(
            ApplicationProvider.getApplicationContext(), BudgetDatabase::class.java,
        ).allowMainThreadQueries().build()
    }

    @After fun closeDatabase() = database.close()

    @Test fun unauthorizedPushKeepsQueuedEditForRepairing() = runBlocking {
        val gateway = BudgetGateway { method, path, _ ->
            if (method == "POST" && path == "/api/v1/sync/push") throw IllegalStateException("401 revoked")
            if (path.startsWith("/api/v1/sync/changes?")) return@BudgetGateway JSONObject("""{"data":{"changes":[],"nextCursor":0,"hasMore":false}}""")
            if (path == "/api/v1/sync/conflicts") return@BudgetGateway JSONObject("""{"data":{"conflicts":[]}}""")
            throw AssertionError("Unexpected $method $path")
        }
        val repository = BudgetRepository(database, gateway, householdId)
        val operationId = repository.queue("category", "create", categoryId, 0, "{\"name\":\"Food\"}")
        var unauthorized = false

        try { repository.syncOnce() } catch (_: IllegalStateException) { unauthorized = true }

        assertTrue(unauthorized)
        assertEquals(operationId, database.budgetDao().getPending(operationId)?.operationId)
    }

    @Test fun separateRepositoryInstancesDoNotPushSameQueuedEditConcurrently() = runBlocking {
        val firstEntered = CountDownLatch(1)
        val releaseFirst = CountDownLatch(1)
        val secondEntered = CountDownLatch(1)
        val pushCount = AtomicInteger(0)
        var operationId = ""
        val gateway = BudgetGateway { method, path, _ ->
            when {
                method == "POST" && path == "/api/v1/sync/push" -> {
                    val count = pushCount.incrementAndGet()
                    if (count == 1) { firstEntered.countDown(); releaseFirst.await(3, TimeUnit.SECONDS) }
                    if (count == 2) secondEntered.countDown()
                    JSONObject("""{"data":{"outcomes":[{"operationId":"$operationId","status":"accepted","revision":1}]}}""")
                }
                method == "GET" && path.startsWith("/api/v1/sync/changes?") -> JSONObject("""{"data":{"changes":[],"nextCursor":0,"hasMore":false}}""")
                path == "/api/v1/sync/conflicts" -> JSONObject("""{"data":{"conflicts":[]}}""")
                else -> throw AssertionError("Unexpected $method $path")
            }
        }
        val first = BudgetRepository(database, gateway, householdId)
        val second = BudgetRepository(database, gateway, householdId)
        operationId = first.queue("category", "create", categoryId, 0, "{\"name\":\"Food\"}")
        val firstJob = async(Dispatchers.IO) { first.syncOnce() }
        assertTrue(firstEntered.await(3, TimeUnit.SECONDS))
        val secondJob = async(Dispatchers.IO) { second.syncOnce() }
        secondEntered.await(500, TimeUnit.MILLISECONDS)
        releaseFirst.countDown()
        firstJob.await()
        secondJob.await()

        assertEquals(1, pushCount.get())
    }

    @Test fun malformedLaterPagePreservesEarlierCommittedPageAndCursor() = runBlocking {
        val gateway = FakeGateway()
        gateway.changeResponses.add(JSONObject("""{"data":{"changes":[{"cursor":7,"entityType":"category","entityId":"$categoryId","revision":1,"deleted":false,"value":{"id":"$categoryId","name":"Food","active":true,"revision":1,"deletedAt":null}}],"nextCursor":7,"hasMore":true}}"""))
        gateway.changeResponses.add(JSONObject("""{"data":{"changes":[{"cursor":8,"entityType":"future_unknown_type","entityId":"33333333-3333-4333-8333-333333333333","revision":1,"deleted":false,"value":{}}],"nextCursor":8,"hasMore":false}}"""))
        var failed = false

        try { BudgetRepository(database, gateway, householdId).syncOnce() }
        catch (_: IllegalStateException) { failed = true }

        assertTrue(failed)
        assertEquals("Food", database.budgetDao().getCategory(categoryId)?.name)
        assertEquals("7", database.budgetDao().syncState(householdId)?.cursor)
    }

    @Test fun nonProgressingPageDoesNotApplyChanges() = runBlocking {
        val gateway = FakeGateway()
        gateway.changesResponse = JSONObject("""{"data":{"changes":[{"cursor":1,"entityType":"category","entityId":"$categoryId","revision":1,"deleted":false,"value":{"id":"$categoryId","name":"Food","active":true,"revision":1,"deletedAt":null}}],"nextCursor":0,"hasMore":true}}""")
        var failed = false

        try { BudgetRepository(database, gateway, householdId).syncOnce() }
        catch (_: IllegalArgumentException) { failed = true }

        assertTrue(failed)
        assertNull(database.budgetDao().getCategory(categoryId))
        assertNull(database.budgetDao().syncState(householdId))
    }

    @Test fun queueSurvivesRepositoryRecreationAndRetryUsesSameOperationId() = runBlocking {
        val gateway = FakeGateway()
        val first = BudgetRepository(database, gateway, householdId)
        val operationId = first.queue("category", "create", categoryId, 0, "{\"name\":\"Food\"}")
        val second = BudgetRepository(database, gateway, householdId)
        gateway.pushResponse = JSONObject("""{"data":{"outcomes":[{"operationId":"$operationId","status":"duplicate"}]}}""")
        gateway.changesResponse = JSONObject("""{"data":{"changes":[],"nextCursor":0,"hasMore":false}}""")

        second.syncOnce()

        assertEquals(operationId, gateway.pushed.getJSONObject(0).getString("operationId"))
        assertEquals(0, database.budgetDao().pendingBatch().size)
    }

    @Test fun pullAppliesCategoryAndCursorTogether() = runBlocking {
        val gateway = FakeGateway()
        gateway.changesResponse = JSONObject("""{"data":{"changes":[{"cursor":7,"entityType":"category","entityId":"$categoryId","revision":3,"deleted":false,"value":{"id":"$categoryId","name":"Groceries","active":true,"revision":3,"deletedAt":null}}],"nextCursor":7,"hasMore":false}}""")

        BudgetRepository(database, gateway, householdId).syncOnce()

        assertEquals("7", database.budgetDao().syncState(householdId)?.cursor)
        assertEquals("Groceries", database.budgetDao().getCategory(categoryId)?.name)
    }

    @Test fun malformedSecondChangeRollsBackFirstChangeAndCursor() = runBlocking {
        val gateway = FakeGateway()
        gateway.changesResponse = JSONObject("""{"data":{"changes":[{"cursor":7,"entityType":"category","entityId":"$categoryId","revision":3,"deleted":false,"value":{"id":"$categoryId","name":"Groceries","active":true,"revision":3,"deletedAt":null}},{"cursor":8,"entityType":"ledger_entry","entityId":"33333333-3333-4333-8333-333333333333","revision":1,"deleted":false,"value":{"id":"33333333-3333-4333-8333-333333333333"}}],"nextCursor":8,"hasMore":false}}""")

        try { BudgetRepository(database, gateway, householdId).syncOnce() } catch (_: Exception) { }

        assertNull(database.budgetDao().getCategory(categoryId))
        assertNull(database.budgetDao().syncState(householdId))
    }

    @Test fun rejectedOperationStaysAvailableWithErrorForCorrection() = runBlocking {
        val gateway = FakeGateway()
        val repository = BudgetRepository(database, gateway, householdId)
        val id = repository.queue("category", "create", categoryId, 0, "{\"name\":\"Food\"}")
        gateway.pushResponse = JSONObject("""{"data":{"outcomes":[{"operationId":"$id","status":"rejected","code":"VALIDATION_ERROR"}]}}""")

        repository.syncOnce()

        assertEquals("rejected", database.budgetDao().getPending(id)?.state)
        assertEquals("VALIDATION_ERROR", database.budgetDao().getPending(id)?.errorCode)
    }

    @Test fun serverTombstoneRemovesCategoryFromVisibleCache() = runBlocking {
        database.budgetDao().upsertCategories(listOf(com.household.budget.data.local.CategoryEntity(categoryId, "Old", true, 1, null)))
        val gateway = FakeGateway()
        gateway.changesResponse = JSONObject("""{"data":{"changes":[{"cursor":2,"entityType":"category","entityId":"$categoryId","revision":2,"deleted":true,"value":null}],"nextCursor":2,"hasMore":false}}""")

        BudgetRepository(database, gateway, householdId).syncOnce()

        assertEquals(2L, database.budgetDao().getCategory(categoryId)?.revision)
        assertTrue(database.budgetDao().getCategory(categoryId)?.deletedAt != null)
    }

    @Test fun conflictPreservesProposalAndServerSnapshot() = runBlocking {
        val gateway = FakeGateway()
        val repository = BudgetRepository(database, gateway, householdId)
        val id = repository.queue("category", "update", categoryId, 1, "{\"name\":\"Food\"}")
        val conflictId = "44444444-4444-4444-8444-444444444444"
        gateway.pushResponse = JSONObject("""{"data":{"outcomes":[{"operationId":"$id","status":"conflict","conflictId":"$conflictId"}]}}""")
        gateway.conflictsResponse = JSONObject("""{"data":{"conflicts":[{"id":"$conflictId","entityType":"category","entityId":"$categoryId","serverValue":{"id":"$categoryId","revision":2,"deletedAt":null,"name":"Groceries","active":true},"proposedValue":{"operationId":"$id","entityId":"$categoryId","entityType":"category","action":"update","baseRevision":1,"value":{"name":"Food"}},"createdAt":"2026-10-05T12:00:00.000Z"}]}}""")

        repository.syncOnce()

        assertEquals("conflict", database.budgetDao().getPending(id)?.state)
        assertEquals("Food", JSONObject(database.budgetDao().getConflict(conflictId)!!.proposedValueJson).getJSONObject("value").getString("name"))
        assertEquals("Groceries", JSONObject(database.budgetDao().getConflict(conflictId)!!.serverValueJson!!).getString("name"))
    }

    @Test fun refreshOccurrencesCachesFutureReminderWindow() = runBlocking {
        val gateway = FakeGateway()
        val ruleId = "66666666-6666-4666-8666-666666666666"
        val occurrenceId = "77777777-7777-4777-8777-777777777777"
        gateway.extraResponses["/api/v1/occurrences?from=2026-10-05&through=2027-01-03&today=2026-10-05"] = JSONObject("""{"data":[{"id":"$occurrenceId","ruleId":"$ruleId","ruleName":"Internet","ruleKind":"bill","expectedDate":"2026-11-05","expectedAmountCents":3500,"status":"expected","displayStatus":"upcoming","actualDate":null,"actualAmountCents":null,"confirmationMethod":null,"needsReview":false,"revision":1}]}""")

        BudgetRepository(database, gateway, householdId).refreshOccurrences("2026-10-05", "2027-01-03", "2026-10-05")

        assertEquals("2026-11-05", database.budgetDao().getOccurrence(occurrenceId)?.expectedDate)
    }

    @Test fun conflictBlocksLaterEditsToSameEntity() = runBlocking {
        val gateway = FakeGateway()
        val repository = BudgetRepository(database, gateway, householdId)
        val first = repository.queue("category", "update", categoryId, 1, "{\"name\":\"Food\"}")
        val later = repository.queue("category", "update", categoryId, 1, "{\"name\":\"Groceries\"}")
        gateway.pushResponse = JSONObject("""{"data":{"outcomes":[{"operationId":"$first","status":"conflict","conflictId":"44444444-4444-4444-8444-444444444444"}]}}""")
        gateway.conflictsResponse = JSONObject("""{"data":{"conflicts":[{"id":"44444444-4444-4444-8444-444444444444","entityType":"category","entityId":"$categoryId","serverValue":null,"proposedValue":{"operationId":"$first"},"createdAt":"2026-10-05T12:00:00Z"}]}}""")

        repository.syncOnce()

        assertEquals(1, gateway.pushBodies.size)
        assertEquals("blocked", database.budgetDao().getPending(later)?.state)
    }

    @Test fun resolvingServerChoiceRemovesConflictAndItsQueuedProposal() = runBlocking {
        val gateway = FakeGateway()
        val conflictId = "44444444-4444-4444-8444-444444444444"
        val operationId = "55555555-5555-4555-8555-555555555555"
        database.budgetDao().upsertPending(com.household.budget.data.local.PendingOperationEntity(
            operationId, categoryId, "category", "update", 1, "{\"name\":\"Food\"}", "2026-10-05T12:00:00Z", "conflict",
        ))
        database.budgetDao().upsertConflicts(listOf(com.household.budget.data.local.SyncConflictEntity(
            conflictId, "category", categoryId, null,
            "{\"operationId\":\"$operationId\",\"entityId\":\"$categoryId\",\"entityType\":\"category\",\"action\":\"update\",\"baseRevision\":1,\"value\":{\"name\":\"Food\"}}",
            "2026-10-05T12:00:00Z",
        )))
        gateway.extraResponses["/api/v1/sync/conflicts/$conflictId/resolve"] = JSONObject("""{"data":{"id":"$conflictId","choice":"server","status":"resolved"}}""")

        BudgetRepository(database, gateway, householdId).resolveConflict(conflictId, "server")

        assertNull(database.budgetDao().getConflict(conflictId))
        assertNull(database.budgetDao().getPending(operationId))
    }

    @Test fun failedProposedResolutionKeepsConflictAndQueuedProposal() = runBlocking {
        val gateway = FakeGateway()
        val conflictId = "44444444-4444-4444-8444-444444444444"
        val operationId = "55555555-5555-4555-8555-555555555555"
        database.budgetDao().upsertPending(com.household.budget.data.local.PendingOperationEntity(
            operationId, categoryId, "category", "update", 1, "{\"name\":\"Food\"}", "2026-10-05T12:00:00Z", "conflict",
        ))
        database.budgetDao().upsertConflicts(listOf(com.household.budget.data.local.SyncConflictEntity(
            conflictId, "category", categoryId, null,
            "{\"operationId\":\"$operationId\",\"entityId\":\"$categoryId\",\"entityType\":\"category\",\"action\":\"update\",\"baseRevision\":1,\"value\":{\"name\":\"Food\"}}",
            "2026-10-05T12:00:00Z",
        )))
        gateway.extraResponses["/api/v1/sync/conflicts/$conflictId/resolve"] = JSONObject("""{"data":{"id":"$conflictId","choice":"proposed","status":"resolved"}}""")
        gateway.failResolve = true

        var failed = false
        try { BudgetRepository(database, gateway, householdId).resolveConflict(conflictId, "proposed") }
        catch (_: IllegalStateException) { failed = true }

        assertTrue(failed)
        assertEquals(conflictId, database.budgetDao().getConflict(conflictId)?.id)
        assertEquals("conflict", database.budgetDao().getPending(operationId)?.state)
    }

    @Test fun staleConflictResolutionRefreshesServerCandidateAndRetainsProposal() = runBlocking {
        val conflictId = "44444444-4444-4444-8444-444444444444"
        val proposal = "{\"operationId\":\"55555555-5555-4555-8555-555555555555\"}"
        database.budgetDao().upsertConflicts(listOf(com.household.budget.data.local.SyncConflictEntity(conflictId, "category", categoryId, "{\"revision\":2}", proposal, "2026-10-01T00:00:00Z")))
        val gateway = BudgetGateway { method, path, _ ->
            if (method == "POST") throw com.household.budget.data.remote.ApiException(409, "CONFLICT", "Changed again")
            assertEquals("/api/v1/sync/conflicts", path)
            JSONObject("""{"data":{"conflicts":[{"id":"$conflictId","entityType":"category","entityId":"$categoryId","serverValue":{"revision":3},"proposedValue":$proposal,"createdAt":"2026-10-01T00:00:00Z"}]}}""")
        }
        try { BudgetRepository(database, gateway, householdId).resolveConflict(conflictId, "proposed"); throw AssertionError("Expected 409") }
        catch (error: com.household.budget.data.remote.ApiException) { assertEquals(409, error.status) }
        assertEquals(3, JSONObject(database.budgetDao().getConflict(conflictId)!!.serverValueJson!!).getInt("revision"))
        assertEquals(proposal, database.budgetDao().getConflict(conflictId)!!.proposedValueJson)
    }

    @Test fun invalidEntityIdIsNotStoredAsUnsyncableOperation() = runBlocking {
        val repository = BudgetRepository(database, FakeGateway(), householdId)
        var rejected = false
        try { repository.queue("category", "create", "not-a-uuid", 0, "{\"name\":\"Food\"}") }
        catch (_: IllegalArgumentException) { rejected = true }

        assertTrue(rejected)
        assertEquals(0, database.budgetDao().pendingBatch().size)
    }

    @Test fun unsupportedOccurrenceCreateIsNotQueued() = runBlocking {
        val repository = BudgetRepository(database, FakeGateway(), householdId)
        var rejected = false
        try { repository.queue("occurrence", "create", categoryId, 0, "{\"status\":\"expected\"}") }
        catch (_: IllegalArgumentException) { rejected = true }

        assertTrue(rejected)
        assertEquals(0, database.budgetDao().pendingBatch().size)
    }

    @Test fun dependentEditWaitsForCreateRevisionAndKeepsItsOperationId() = runBlocking {
        val gateway = FakeGateway()
        val repository = BudgetRepository(database, gateway, householdId)
        val createId = repository.queue("category", "create", categoryId, 0, "{\"name\":\"Food\"}")
        val updateId = repository.queue("category", "update", categoryId, 0, "{\"name\":\"Groceries\"}")
        gateway.pushResponses.add(JSONObject("""{"data":{"outcomes":[{"operationId":"$createId","status":"accepted","revision":1}]}}"""))
        gateway.pushResponses.add(JSONObject("""{"data":{"outcomes":[{"operationId":"$updateId","status":"accepted","revision":2}]}}"""))

        repository.syncOnce()

        assertEquals(2, gateway.pushBodies.size)
        assertEquals(createId, gateway.pushBodies[0].getJSONObject(0).getString("operationId"))
        assertEquals(updateId, gateway.pushBodies[1].getJSONObject(0).getString("operationId"))
        assertEquals(1L, gateway.pushBodies[1].getJSONObject(0).getLong("baseRevision"))
        assertEquals(0, database.budgetDao().pendingBatch().size)
    }

    @Test fun occurrenceFeedUsesCachedRuleForDisplayFields() = runBlocking {
        val ruleId = "66666666-6666-4666-8666-666666666666"
        val occurrenceId = "77777777-7777-4777-8777-777777777777"
        database.budgetDao().upsertRules(listOf(com.household.budget.data.local.RecurringRuleEntity(
            ruleId, "bill", "Internet", null, 3500, "monthly", 1, "2026-01-01", null, null, true, 1, null,
        )))
        val gateway = FakeGateway()
        gateway.changesResponse = JSONObject("""{"data":{"changes":[{"cursor":9,"entityType":"occurrence","entityId":"$occurrenceId","revision":2,"deleted":false,"value":{"ruleId":"$ruleId","expectedDate":"2026-10-05","expectedAmountCents":3500,"status":"expected","actualDate":null,"actualAmountCents":null,"confirmationMethod":null,"needsReview":false}}],"nextCursor":9,"hasMore":false}}""")

        BudgetRepository(database, gateway, householdId).syncOnce()

        assertEquals("Internet", database.budgetDao().getOccurrence(occurrenceId)?.ruleName)
        assertEquals("bill", database.budgetDao().getOccurrence(occurrenceId)?.ruleKind)
    }

    @Test fun conflictDetailsAreRecoveredAfterNetworkInterruption() = runBlocking {
        val gateway = FakeGateway()
        val repository = BudgetRepository(database, gateway, householdId)
        val id = repository.queue("category", "update", categoryId, 1, "{\"name\":\"Food\"}")
        val conflictId = "44444444-4444-4444-8444-444444444444"
        gateway.pushResponse = JSONObject("""{"data":{"outcomes":[{"operationId":"$id","status":"conflict","conflictId":"$conflictId"}]}}""")
        gateway.conflictsResponse = JSONObject("""{"data":{"conflicts":[{"id":"$conflictId","entityType":"category","entityId":"$categoryId","serverValue":null,"proposedValue":{"operationId":"$id","entityId":"$categoryId","entityType":"category","action":"update","baseRevision":1,"value":{"name":"Food"}},"createdAt":"2026-10-05T12:00:00.000Z"}]}}""")
        gateway.failConflictsOnce = true
        try { repository.syncOnce() } catch (_: IllegalStateException) { }
        assertEquals(conflictId, database.budgetDao().getConflict(conflictId)?.id)

        repository.syncOnce()

        assertEquals("conflict", database.budgetDao().getPending(id)?.state)
        assertEquals(conflictId, database.budgetDao().getConflict(conflictId)?.id)
    }

    @Test fun refreshMonthCachesServerFiguresAndEntriesForOfflineRead() = runBlocking {
        val gateway = FakeGateway()
        val entryId = "55555555-5555-4555-8555-555555555555"
        gateway.extraResponses["/api/v1/months/2026-10/plan"] = JSONObject("""{"data":{"month":"2026-10","openingSpendableCents":10000,"expectedIncomeCents":5000,"expectedBillsCents":1000,"estimateCents":500,"savingsTargetCents":1000,"moneyLeftCents":12500,"estimates":[],"savingsTarget":null}}""")
        gateway.extraResponses["/api/v1/months/2026-10/actuals?today=2026-10-05"] = JSONObject("""{"data":{"month":"2026-10","confirmedIncomeCents":5000}}""")
        gateway.extraResponses["/api/v1/balances?asOf=2026-10-05"] = JSONObject("""{"data":{"spendableCents":14000,"savingsCents":2000,"combinedCents":16000}}""")
        gateway.extraResponses["/api/v1/entries?month=2026-10"] = JSONObject("""{"data":[{"id":"$entryId","kind":"expense","entryDate":"2026-10-05","amountCents":500,"categoryId":null,"account":"spendable","note":"Coffee","occurrenceId":null,"revision":1,"deletedAt":null}]}""")
        gateway.extraResponses["/api/v1/occurrences?from=2026-10-01&through=2026-10-31&today=2026-10-05"] = JSONObject("""{"data":[]}""")

        BudgetRepository(database, gateway, householdId).refreshMonth("2026-10", "2026-10-05")

        val snapshot = database.budgetDao().getMonthSnapshot("2026-10")!!
        assertEquals(12500, JSONObject(snapshot.planJson).getLong("moneyLeftCents"))
        assertEquals(14000, JSONObject(snapshot.balancesJson).getLong("spendableCents"))
        assertEquals("Coffee", database.budgetDao().getEntry(entryId)?.note)
    }

    @Test fun emptyPageWithAdvancingCursorContinuesToNextPage() = runBlocking {
        val gateway = FakeGateway()
        gateway.changeResponses.add(JSONObject("""{"data":{"changes":[],"nextCursor":100,"hasMore":true}}"""))
        gateway.changesResponse = JSONObject("""{"data":{"changes":[{"cursor":101,"entityType":"category","entityId":"$categoryId","revision":1,"deleted":false,"value":{"name":"Food","active":true}}],"nextCursor":101,"hasMore":false}}""")
        BudgetRepository(database, gateway, householdId).syncOnce()
        assertEquals("101", database.budgetDao().syncState(householdId)?.cursor)
        assertEquals("Food", database.budgetDao().getCategory(categoryId)?.name)
    }

    @Test fun resolvedConflictReleasesLaterEditsAtPulledRevision() = runBlocking {
        val gateway = FakeGateway()
        val repository = BudgetRepository(database, gateway, householdId)
        val (conflictId, original, later) = seedConflict(repository)
        gateway.extraResponses["/api/v1/sync/conflicts/$conflictId/resolve"] = JSONObject("""{"data":{"id":"$conflictId","choice":"proposed","status":"resolved"}}""")
        gateway.changesResponse = categoryPage(3)
        repository.resolveConflict(conflictId, "proposed")
        assertNull(database.budgetDao().getPending(original))
        assertEquals("pending", database.budgetDao().getPending(later)?.state)
        assertEquals(3L, database.budgetDao().getPending(later)?.baseRevision)
        assertEquals(1L, gateway.resolveBodies.single().getLong("serverRevision"))
    }

    @Test fun otherPhoneResolutionRemovesCachedConflictAndSendsDependentEdit() = runBlocking {
        val gateway = FakeGateway()
        val repository = BudgetRepository(database, gateway, householdId)
        val (conflictId, original, later) = seedConflict(repository)
        gateway.changesResponse = categoryPage(3)
        gateway.pushResponse = JSONObject("""{"data":{"outcomes":[{"operationId":"$later","status":"accepted","revision":4}]}}""")
        repository.syncOnce()
        assertNull(database.budgetDao().getConflict(conflictId))
        assertNull(database.budgetDao().getPending(original))
        assertNull(database.budgetDao().getPending(later))
        assertEquals(3L, gateway.pushed.getJSONObject(0).getLong("baseRevision"))
    }

    @Test fun deletedConflictTargetRejectsDependentEditsWithoutDroppingThem() = runBlocking {
        val gateway = FakeGateway()
        val repository = BudgetRepository(database, gateway, householdId)
        val (_, _, later) = seedConflict(repository)
        gateway.changesResponse = JSONObject("""{"data":{"changes":[{"cursor":3,"entityType":"category","entityId":"$categoryId","revision":3,"deleted":true,"value":null}],"nextCursor":3,"hasMore":false}}""")
        repository.syncOnce()
        assertEquals("rejected", database.budgetDao().getPending(later)?.state)
        assertEquals("ENTITY_DELETED", database.budgetDao().getPending(later)?.errorCode)
    }

    @Test fun transientServerOutcomeKeepsOriginalEditRetryable() = runBlocking {
        val gateway = FakeGateway()
        val repository = BudgetRepository(database, gateway, householdId)
        val id = repository.queue("category", "create", categoryId, 0, "{\"name\":\"Food\"}")
        gateway.pushResponse = JSONObject("""{"data":{"outcomes":[{"operationId":"$id","status":"rejected","code":"OPERATION_FAILED"}]}}""")
        try { repository.syncOnce(); throw AssertionError("Expected retryable failure") }
        catch (_: java.io.IOException) { }
        assertEquals("pending", database.budgetDao().getPending(id)?.state)
        gateway.pushResponse = JSONObject("""{"data":{"outcomes":[{"operationId":"$id","status":"accepted","revision":1}]}}""")
        repository.syncOnce()
        assertNull(database.budgetDao().getPending(id))
        assertEquals(id, gateway.pushed.getJSONObject(0).getString("operationId"))
    }

    @Test fun restoreRebuildsAcceptedCacheAndPreservesQueuedProposalForReview() = runBlocking {
        val gateway = FakeGateway()
        val repository = BudgetRepository(database, gateway, householdId)
        val id = repository.queue("category", "update", categoryId, 2, "{\"name\":\"Local\"}")
        val dao = database.budgetDao()
        val staleId = "33333333-3333-4333-8333-333333333333"
        dao.upsertCategories(listOf(com.household.budget.data.local.CategoryEntity(staleId, "Rolled back", true, 1, null)))
        dao.upsertSyncState(com.household.budget.data.local.SyncStateEntity(householdId, "500"))
        dao.upsertCache(com.household.budget.data.local.CacheDocumentEntity("sync-generation", "old-generation"))
        dao.upsertCache(com.household.budget.data.local.CacheDocumentEntity("last-sync", "stale"))
        gateway.changeResponses.add(JSONObject("""{"data":{"generation":"new-generation","changes":[],"nextCursor":500,"hasMore":false}}"""))
        gateway.changesResponse = categoryPage(1).apply { getJSONObject("data").put("generation", "new-generation") }
        val conflictId = "44444444-4444-4444-8444-444444444444"
        gateway.pushResponse = JSONObject("""{"data":{"outcomes":[{"operationId":"$id","status":"conflict","conflictId":"$conflictId"}]}}""")
        gateway.conflictsResponse = JSONObject("""{"data":{"conflicts":[{"id":"$conflictId","entityType":"category","entityId":"$categoryId","serverValue":{"id":"$categoryId","revision":1},"proposedValue":{"operationId":"$id","entityId":"$categoryId","entityType":"category","action":"update","baseRevision":9007199254740991,"value":{"name":"Local"}},"createdAt":"2026-10-05T12:00:00Z"}]}}""")
        repository.syncOnce()
        assertNull(dao.getCategory(staleId))
        assertNull(dao.getCache("last-sync"))
        assertEquals("new-generation", dao.getCache("sync-generation")?.payloadJson)
        assertEquals("1", dao.syncState(householdId)?.cursor)
        assertEquals("conflict", dao.getPending(id)?.state)
        assertEquals("Local", JSONObject(dao.getPending(id)!!.valueJson!!).getString("name"))
        assertEquals(9007199254740991L, gateway.pushed.getJSONObject(0).getLong("baseRevision"))
        assertEquals("new-generation", gateway.pushEnvelopes.single().getString("generation"))
    }

    @Test fun legacyDuplicateConflictStillRequiresReview() = runBlocking {
        val gateway = FakeGateway()
        val repository = BudgetRepository(database, gateway, householdId)
        val id = repository.queue("category", "update", categoryId, 1, "{\"name\":\"Local\"}")
        val conflictId = "44444444-4444-4444-8444-444444444444"
        gateway.pushResponse = JSONObject("""{"data":{"outcomes":[{"operationId":"$id","status":"duplicate","revision":2,"conflictId":"$conflictId"}]}}""")
        gateway.conflictsResponse = JSONObject("""{"data":{"conflicts":[{"id":"$conflictId","entityType":"category","entityId":"$categoryId","serverValue":{"id":"$categoryId","revision":2},"proposedValue":{"operationId":"$id","entityId":"$categoryId","entityType":"category","action":"update","baseRevision":1,"value":{"name":"Local"}},"createdAt":"2026-10-05T12:00:00Z"}]}}""")
        repository.syncOnce()
        assertEquals("conflict", database.budgetDao().getPending(id)?.state)
        assertEquals(conflictId, database.budgetDao().getConflict(conflictId)?.id)
    }

    @Test fun previouslyRejectedStorageFailureAndDependentEditRetryWithTheirOriginalIds() = runBlocking {
        val gateway = FakeGateway()
        val repository = BudgetRepository(database, gateway, householdId)
        val original = repository.queue("category", "create", categoryId, 0, "{\"name\":\"First\"}")
        val later = repository.queue("category", "update", categoryId, 0, "{\"name\":\"Later\"}")
        database.budgetDao().setPendingState(original, "rejected", "OPERATION_FAILED")
        database.budgetDao().blockPendingEntity(categoryId)
        gateway.pushResponses.add(JSONObject("""{"data":{"outcomes":[{"operationId":"$original","status":"accepted","revision":1}]}}"""))
        gateway.pushResponses.add(JSONObject("""{"data":{"outcomes":[{"operationId":"$later","status":"accepted","revision":2}]}}"""))
        repository.syncOnce()
        assertNull(database.budgetDao().getPending(original))
        assertNull(database.budgetDao().getPending(later))
        assertEquals(listOf(original, later), gateway.pushBodies.map { it.getJSONObject(0).getString("operationId") })
        assertEquals(1L, gateway.pushBodies[1].getJSONObject(0).getLong("baseRevision"))
    }

    @Test fun replayRetainsConfirmedOccurrenceDisplayWhenItsRuleWasDeleted() = runBlocking {
        val gateway = FakeGateway()
        val ruleId = "66666666-6666-4666-8666-666666666666"
        val occurrenceId = "77777777-7777-4777-8777-777777777777"
        gateway.changesResponse = JSONObject("""{"data":{"changes":[{"cursor":9,"entityType":"occurrence","entityId":"$occurrenceId","revision":2,"deleted":false,"value":{"ruleId":"$ruleId","ruleName":"Old bill","ruleKind":"bill","expectedDate":"2026-10-05","expectedAmountCents":3500,"status":"confirmed","actualDate":"2026-10-05","actualAmountCents":3500,"confirmationMethod":"manual","needsReview":false}}],"nextCursor":9,"hasMore":false}}""")
        BudgetRepository(database, gateway, householdId).syncOnce()
        assertEquals("Old bill", database.budgetDao().getOccurrence(occurrenceId)?.ruleName)
        assertEquals("confirmed", database.budgetDao().getOccurrence(occurrenceId)?.status)
    }

    @Test fun upgradeReleasesEditsStrandedAfterAnOlderConflictResolution() = runBlocking {
        val gateway = FakeGateway()
        val repository = BudgetRepository(database, gateway, householdId)
        val later = repository.queue("category", "update", categoryId, 1, "{\"name\":\"Later\"}")
        database.budgetDao().blockPendingEntity(categoryId)
        gateway.changesResponse = categoryPage(3)
        gateway.pushResponse = JSONObject("""{"data":{"outcomes":[{"operationId":"$later","status":"accepted","revision":4}]}}""")
        repository.syncOnce()
        assertNull(database.budgetDao().getPending(later))
        assertEquals(3L, gateway.pushed.getJSONObject(0).getLong("baseRevision"))
    }

    private fun categoryPage(revision: Long) = JSONObject("""{"data":{"changes":[{"cursor":$revision,"entityType":"category","entityId":"$categoryId","revision":$revision,"deleted":false,"value":{"name":"Server","active":true}}],"nextCursor":$revision,"hasMore":false}}""")

    private suspend fun seedConflict(repository: BudgetRepository): Triple<String, String, String> {
        val original = repository.queue("category", "update", categoryId, 1, "{\"name\":\"First\"}")
        val later = repository.queue("category", "update", categoryId, 1, "{\"name\":\"Later\"}")
        val dao = database.budgetDao()
        dao.setPendingState(original, "conflict", null)
        dao.blockPendingEntity(categoryId)
        val conflictId = "44444444-4444-4444-8444-444444444444"
        dao.upsertConflicts(listOf(com.household.budget.data.local.SyncConflictEntity(conflictId, "category", categoryId,
            "{\"id\":\"$categoryId\",\"revision\":1}", "{\"operationId\":\"$original\"}", "2026-10-05T12:00:00Z")))
        return Triple(conflictId, original, later)
    }

    private class FakeGateway : BudgetGateway {
        var pushResponse = JSONObject("""{"data":{"outcomes":[]}}""")
        val changeResponses = mutableListOf<JSONObject>()
        var changesResponse = JSONObject("""{"data":{"changes":[],"nextCursor":0,"hasMore":false}}""")
        val extraResponses = mutableMapOf<String, JSONObject>()
        var failResolve = false
        var failConflictsOnce = false
        var conflictsResponse = JSONObject("""{"data":{"conflicts":[]}}""")
        val pushResponses = mutableListOf<JSONObject>()
        val pushBodies = mutableListOf<JSONArray>()
        val pushEnvelopes = mutableListOf<JSONObject>()
        val resolveBodies = mutableListOf<JSONObject>()
        var pushed = JSONArray()
        override fun request(method: String, path: String, body: JSONObject?): JSONObject {
            return when {
                method == "POST" && path == "/api/v1/sync/push" -> {
                    pushed = body!!.getJSONArray("operations")
                    pushBodies.add(JSONArray(pushed.toString()))
                    pushEnvelopes.add(JSONObject(body.toString()))
                    if (pushResponses.isNotEmpty()) pushResponses.removeAt(0) else pushResponse
                }
                method == "GET" && path.startsWith("/api/v1/sync/changes?") -> if (changeResponses.isNotEmpty()) changeResponses.removeAt(0) else changesResponse
                method == "GET" && path == "/api/v1/sync/conflicts" -> {
                    if (failConflictsOnce && pushBodies.isNotEmpty()) { failConflictsOnce = false; error("Offline") }
                    conflictsResponse
                }
                method == "POST" && path in extraResponses -> {
                    resolveBodies.add(JSONObject(body!!.toString()))
                    if (failResolve) error("409")
                    extraResponses.getValue(path)
                }
                method == "GET" && path in extraResponses -> extraResponses.getValue(path)
                else -> throw AssertionError("Unexpected $method $path")
            }
        }
    }
}
