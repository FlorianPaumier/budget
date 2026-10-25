package com.household.budget.work

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.work.ListenableWorker
import androidx.work.WorkerFactory
import androidx.work.WorkerParameters
import androidx.work.testing.TestListenableWorkerBuilder
import com.household.budget.application.BudgetSessionServices
import com.household.budget.data.remote.ApiException
import java.io.IOException
import java.time.Clock
import java.time.Instant
import java.time.YearMonth
import java.time.ZoneOffset
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class BudgetSyncWorkerTest {
    private val clock = Clock.fixed(Instant.parse("2026-10-05T12:00:00Z"), ZoneOffset.UTC)

    @Test fun refreshesCurrentMonthAndSucceeds() = runBlocking {
        val services = FakeServices()
        val result = worker(services).doWork()
        assertTrue(result is ListenableWorker.Result.Success)
        assertEquals(YearMonth.of(2026, 10), services.refreshed)
    }

    @Test fun networkFailureRetries() = runBlocking {
        val services = FakeServices(IOException("offline"))
        assertTrue(worker(services).doWork() is ListenableWorker.Result.Retry)
    }

    @Test fun revokedCredentialFailsWithoutRetry() = runBlocking {
        val services = FakeServices(ApiException(401, "UNAUTHORIZED", "revoked"))
        assertTrue(worker(services).doWork() is ListenableWorker.Result.Failure)
    }

    @Test fun validationFailureFailsWithoutRetry() = runBlocking {
        val services = FakeServices(ApiException(422, "VALIDATION_ERROR", "bad edit"))
        assertTrue(worker(services).doWork() is ListenableWorker.Result.Failure)
    }

    private fun worker(services: BudgetSessionServices): BudgetSyncWorker {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val factory = object : WorkerFactory() {
            override fun createWorker(context: Context, workerClassName: String,
                                      workerParameters: WorkerParameters): ListenableWorker? =
                if (workerClassName == BudgetSyncWorker::class.java.name)
                    BudgetSyncWorker(context, workerParameters, services, clock) else null
        }
        return TestListenableWorkerBuilder.from(context, BudgetSyncWorker::class.java)
            .setWorkerFactory(factory).build()
    }

    private class FakeServices(private val failure: Exception? = null) : BudgetSessionServices {
        var refreshed: YearMonth? = null
        override suspend fun health(url: String): Boolean = true
        override suspend fun pair(url: String, code: String, label: String) = Unit
        override suspend fun refresh(month: YearMonth) {
            failure?.let { throw it }
            refreshed = month
        }
    }
}
