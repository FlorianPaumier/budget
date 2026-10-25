package com.household.budget.application

import com.household.budget.data.local.CategoryEntity
import com.household.budget.data.local.MonthlyEstimateEntity
import com.household.budget.ui.EstimateRow

fun planRowsFromCache(categories: List<CategoryEntity>, estimates: List<MonthlyEstimateEntity>, suggestions: List<com.household.budget.household.SpendingSuggestion> = emptyList()): List<EstimateRow> = categories.filter { it.active && it.deletedAt == null }.map { category ->
    val estimate = estimates.firstOrNull { it.categoryId == category.id && it.deletedAt == null }
    val suggestion = suggestions.firstOrNull { it.categoryId == category.id }
    EstimateRow(category.id, category.name, estimate?.amountCents ?: 0,
        suggestion?.amountCents, suggestion?.sampleCount ?: 0)
}
