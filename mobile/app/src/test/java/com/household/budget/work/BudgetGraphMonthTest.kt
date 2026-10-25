package com.household.budget.work

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.household.budget.application.BudgetGraph
import com.household.budget.data.local.BudgetDatabase
import com.household.budget.data.local.HouseholdEntity
import com.household.budget.security.PairedDevice
import com.household.budget.security.PairingCredentialStore
import java.time.Clock
import java.time.Instant
import java.time.YearMonth
import java.time.ZoneOffset
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class BudgetGraphMonthTest {
    @Test fun cachedHouseholdZoneDeterminesCurrentMonthAtUtcBoundary() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val database = Room.inMemoryDatabaseBuilder(context, BudgetDatabase::class.java).build()
        try {
            database.budgetDao().upsertHousehold(HouseholdEntity(
                id = "home", currency = "CAD", timeZone = "America/Toronto", reminderTime = "09:00",
                openingSpendableCents = 0, openingSavingsCents = 0, openingDate = "2026-10-01",
                monthlySavingsTargetCents = null, revision = 1,
            ))
            val clock = Clock.fixed(Instant.parse("2026-11-01T01:30:00Z"), ZoneOffset.UTC)
            val credentials = object : PairingCredentialStore {
                override fun load() = PairedDevice("https://budget.home.arpa", "phone", "home", "secret")
                override fun save(device: PairedDevice) = Unit
            }
            val graph = BudgetGraph(context, credentials = credentials, clock = clock,
                databaseFactory = { database }, periodicSyncRegistration = {}, immediateSyncEnqueue = {})

            assertEquals(YearMonth.of(2026, 10), graph.currentMonth())
        } finally { database.close() }
    }
}
