package com.household.budget.application

import com.household.budget.data.local.CategoryEntity
import com.household.budget.data.local.MonthlyEstimateEntity
import org.junit.Assert.*
import org.junit.Test

class PlanRowsMappingTest {
    @Test fun `cached suggestion displays alongside unchanged accepted estimate`() {
        val rows = planRowsFromCache(listOf(CategoryEntity("one", "Food", true, 1, null)),
            listOf(MonthlyEstimateEntity("e", "one", "2026-10", 1000, 1, null)),
            listOf(com.household.budget.household.SpendingSuggestion("one", "2026-10", 2500, 5)))
        assertEquals(1000L, rows.single().amountCents)
        assertEquals(2500L, rows.single().suggestedCents)
        assertEquals(5, rows.single().sampleCount)
    }
    @Test fun `active categories show accepted estimate or zero without invented suggestions`() {
        val categories = listOf(CategoryEntity("one", "Food", true, 1, null),
            CategoryEntity("two", "Fuel", true, 1, null), CategoryEntity("old", "Old", false, 1, null))
        val rows = planRowsFromCache(categories, listOf(MonthlyEstimateEntity("e", "one", "2026-10", 12345, 7, null)))
        assertEquals(listOf("one", "two"), rows.map { it.categoryId })
        assertEquals(12345L, rows[0].amountCents)
        assertEquals(0L, rows[1].amountCents)
        assertNull(rows[0].suggestedCents)
        assertEquals(0, rows[0].sampleCount)
    }
}
