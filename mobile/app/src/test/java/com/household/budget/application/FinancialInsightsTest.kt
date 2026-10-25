package com.household.budget.application
import com.household.budget.ui.*
import java.time.YearMonth
import org.junit.Assert.*
import org.junit.Test
class FinancialInsightsTest {
    @Test fun `insights isolate month and separate transfers from spending`() {
        fun row(id: String, date: String, kind: EntryKind, cents: Long) = EntryRow(id, date, kind, cents, "Food", null, false)
        val result = financialInsights(YearMonth.of(2026, 10), listOf(
            row("1", "2026-10-02", EntryKind.EXPENSE, 4200),
            row("2", "2026-10-02", EntryKind.INCOME, 20000),
            row("3", "2026-10-03", EntryKind.SAVINGS_TRANSFER, 5000),
            row("4", "2026-09-30", EntryKind.EXPENSE, 9999),
            row("5", "2026-10-04", EntryKind.CATEGORY_ADJUSTMENT, 1000)))
        assertEquals(5200L, result.expenseCents)
        assertEquals(20000L, result.incomeCents)
        assertEquals(31, result.daily.size)
        assertEquals(4200L, result.daily[1].cents)
        assertEquals(0L, result.daily[2].cents)
        assertEquals(5200L, result.categories.single().cents)
    }
    @Test fun `quarter covers year boundary and month excludes future dated activity`() {
        fun row(date: String, cents: Long) = EntryRow(date, date, EntryKind.EXPENSE, cents, "Food", null, false)
        val rows = listOf(row("2025-11-01", 100), row("2025-12-31", 200), row("2026-01-04", 300), row("2026-01-20", 400))
        val quarter = periodInsights(YearMonth.of(2026,1), InsightPeriod.QUARTER, rows, java.time.LocalDate.parse("2026-01-05"))
        assertEquals(600L, quarter.expenseCents)
        assertEquals(java.time.LocalDate.parse("2025-11-01"), quarter.daily.first().date)
        val month = periodInsights(YearMonth.of(2026,1), InsightPeriod.MONTH, rows, java.time.LocalDate.parse("2026-01-05"))
        assertEquals(300L, month.expenseCents)
        assertEquals(200L, month.previousExpenseCents)
    }
}
