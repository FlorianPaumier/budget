package com.household.budget.work

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequest
import androidx.work.PeriodicWorkRequest
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

object SyncWorkScheduler {
    const val PERIODIC_NAME = "budget-periodic-sync"
    const val IMMEDIATE_NAME = "budget-immediate-sync"

    private val networkConstraint = Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED).build()

    fun periodicRequest(): PeriodicWorkRequest =
        PeriodicWorkRequest.Builder(BudgetSyncWorker::class.java, 15, TimeUnit.MINUTES)
            .setConstraints(networkConstraint)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()

    fun immediateRequest(): OneTimeWorkRequest = OneTimeWorkRequest.Builder(BudgetSyncWorker::class.java)
        .setConstraints(networkConstraint)
        .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
        .build()

    fun register(context: Context) {
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            PERIODIC_NAME, ExistingPeriodicWorkPolicy.KEEP, periodicRequest())
    }

    fun enqueueNow(context: Context) {
        WorkManager.getInstance(context).enqueueUniqueWork(
            IMMEDIATE_NAME, ExistingWorkPolicy.KEEP, immediateRequest())
    }
}
