package com.household.budget.work

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.household.budget.application.BudgetApplication
import com.household.budget.application.BudgetSessionServices
import com.household.budget.data.remote.ApiException
import java.io.IOException
import java.time.Clock
import java.time.YearMonth
import kotlinx.coroutines.CancellationException

class BudgetSyncWorker(
    context: Context,
    parameters: WorkerParameters,
) : CoroutineWorker(context, parameters) {
    private val graph = (context.applicationContext as BudgetApplication).graph
    private var canSync: () -> Boolean = { (applicationContext as BudgetApplication).graph.syncEnabled.value }
    private var services: BudgetSessionServices = graph
    private var currentMonth: suspend () -> YearMonth = graph::currentMonth

    internal constructor(context: Context, parameters: WorkerParameters,
                         services: BudgetSessionServices, clock: Clock) : this(context, parameters) {
        this.canSync = { true }
        this.services = services
        this.currentMonth = { YearMonth.now(clock) }
    }

    override suspend fun doWork(): Result { return try {
        if (!canSync()) return Result.failure()
        services.refresh(currentMonth())
        Result.success()
    } catch (failure: CancellationException) {
        throw failure
    } catch (failure: ApiException) {
        if (failure.status == 429 || failure.status >= 500) Result.retry() else Result.failure()
    } catch (failure: IOException) {
        Result.retry()
    } catch (_: Exception) {
        Result.failure()
    }
    }
}
