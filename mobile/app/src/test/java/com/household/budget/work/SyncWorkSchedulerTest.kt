package com.household.budget.work

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.work.BackoffPolicy
import androidx.work.NetworkType
import androidx.work.WorkManager
import androidx.work.testing.WorkManagerTestInitHelper
import java.util.concurrent.TimeUnit
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class SyncWorkSchedulerTest {
    @Test fun periodicRequestRequiresNetworkAndFifteenMinuteInterval() {
        val spec = SyncWorkScheduler.periodicRequest().workSpec
        assertEquals(NetworkType.CONNECTED, spec.constraints.requiredNetworkType)
        assertEquals(TimeUnit.MINUTES.toMillis(15), spec.intervalDuration)
        assertEquals(BackoffPolicy.EXPONENTIAL, spec.backoffPolicy)
    }

    @Test fun immediateRequestRequiresNetworkAndBacksOff() {
        val spec = SyncWorkScheduler.immediateRequest().workSpec
        assertEquals(NetworkType.CONNECTED, spec.constraints.requiredNetworkType)
        assertEquals(BackoffPolicy.EXPONENTIAL, spec.backoffPolicy)
    }

    @Test fun registeringTwiceKeepsOnePeriodicJob() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        WorkManagerTestInitHelper.initializeTestWorkManager(context)

        SyncWorkScheduler.register(context)
        SyncWorkScheduler.register(context)

        val jobs = WorkManager.getInstance(context)
            .getWorkInfosForUniqueWork(SyncWorkScheduler.PERIODIC_NAME).get()
        assertEquals(1, jobs.size)
    }

    @Test fun enqueueingTwiceKeepsOneImmediateJob() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        WorkManagerTestInitHelper.initializeTestWorkManager(context)

        SyncWorkScheduler.enqueueNow(context)
        SyncWorkScheduler.enqueueNow(context)

        val jobs = WorkManager.getInstance(context)
            .getWorkInfosForUniqueWork(SyncWorkScheduler.IMMEDIATE_NAME).get()
        assertEquals(1, jobs.size)
    }
}
