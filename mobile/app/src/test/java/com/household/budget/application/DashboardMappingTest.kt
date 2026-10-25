package com.household.budget.application

import com.household.budget.data.local.HouseholdEntity
import com.household.budget.data.local.MonthSnapshotEntity
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant
import java.time.YearMonth

class DashboardMappingTest {
    private val household = HouseholdEntity("home", "CAD", "America/Toronto", "09:00", 10000, 1000, "2026-10-01", null, 1)
    @Test fun `dashboard keeps planned and actual server amounts distinct`() {
        val snapshot = MonthSnapshotEntity("2026-10", "2026-10-05", """{"moneyLeftCents":12500}""", """{"moneyLeftTodayCents":2300}""", """{"spendableCents":2300,"savingsCents":1000,"combinedCents":3300}""")
        val result = dashboardFromCache(household, YearMonth.of(2026, 10), snapshot, Instant.parse("2026-10-05T12:00:00Z"))
        assertEquals(12500L, result.plannedMoneyLeftCents)
        assertEquals(2300L, result.actualMoneyLeftTodayCents)
        assertEquals(3300L, result.combinedCents)
    }
    @Test fun `month follows household date when UTC has entered next month`() {
        val result = dashboardFromCache(household, YearMonth.of(2026, 10), null, Instant.parse("2026-11-01T02:00:00Z"))
        assertEquals(YearMonth.of(2026, 10), result.currentMonth)
        assertNull(result.plannedMoneyLeftCents)
    }
    @Test fun `cache for another selected month is not displayed`() {
        val snapshot = MonthSnapshotEntity("2026-09", "2026-09-30", """{"moneyLeftCents":99999}""", "{}", "{}")
        val result = dashboardFromCache(household, YearMonth.of(2026, 10), snapshot, Instant.parse("2026-10-05T12:00:00Z"))
        assertNull(result.plannedMoneyLeftCents)
    }
}
