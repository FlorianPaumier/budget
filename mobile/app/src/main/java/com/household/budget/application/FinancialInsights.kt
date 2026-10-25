package com.household.budget.application

import com.household.budget.ui.EntryKind
import com.household.budget.ui.EntryRow
import java.time.LocalDate
import java.time.YearMonth

data class DailyAmount(val date: LocalDate, val cents: Long)
data class CategoryAmount(val name: String, val cents: Long)
data class FinancialInsights(
    val month: YearMonth,
    val incomeCents: Long = 0,
    val expenseCents: Long = 0,
    val daily: List<DailyAmount> = emptyList(),
    val categories: List<CategoryAmount> = emptyList(),
    val recent: List<EntryRow> = emptyList(),
    val previousExpenseCents: Long? = null,
    val previousIncomeCents: Long? = null,
)

/** Accepted ledger only, using the server spending semantics (including category adjustments). */
fun financialInsights(month: YearMonth, entries: List<EntryRow>): FinancialInsights {
    val rows = entries.filter { runCatching { YearMonth.from(LocalDate.parse(it.entryDate)) == month }.getOrDefault(false) }
    val expenses = rows.filter { it.kind == EntryKind.EXPENSE || it.kind == EntryKind.CATEGORY_ADJUSTMENT }
    val days = expenses.groupBy { LocalDate.parse(it.entryDate) }
    return FinancialInsights(month,
        rows.filter { it.kind == EntryKind.INCOME }.sumOf { it.amountCents },
        expenses.sumOf { it.amountCents },
        (1..month.lengthOfMonth()).map { day -> DailyAmount(month.atDay(day), days[month.atDay(day)].orEmpty().sumOf { it.amountCents }) },
        expenses.groupBy { it.categoryName ?: "Sans catégorie" }.map { (name, rows) -> CategoryAmount(name, rows.sumOf { it.amountCents }) }.sortedByDescending { it.cents },
        rows.sortedWith(compareByDescending<EntryRow> { it.entryDate }.thenBy { it.id }).take(5))
}

enum class InsightPeriod(val label: String) { WEEK("Semaine"), MONTH("Mois"), QUARTER("3 mois"), YEAR("Année") }

fun periodInsights(month: YearMonth, period: InsightPeriod, entries: List<EntryRow>, today: LocalDate): FinancialInsights {
    val end = if (YearMonth.from(today) == month) today else month.atEndOfMonth()
    val start = when(period) {
        InsightPeriod.WEEK -> end.minusDays(6)
        InsightPeriod.MONTH -> month.atDay(1)
        InsightPeriod.QUARTER -> month.minusMonths(2).atDay(1)
        InsightPeriod.YEAR -> month.minusMonths(11).atDay(1)
    }
    val rows = entries.filter { runCatching { val date=LocalDate.parse(it.entryDate); date >= start && date <= end }.getOrDefault(false) }
    val spending = rows.filter { it.kind == EntryKind.EXPENSE || it.kind == EntryKind.CATEGORY_ADJUSTMENT }
    val days = spending.groupBy { LocalDate.parse(it.entryDate) }
    val count = java.time.temporal.ChronoUnit.DAYS.between(start,end).toInt()+1
    val previousRows = entries.filter { it.entryDate.startsWith(month.minusMonths(1).toString()) }
    val previous = financialInsights(month.minusMonths(1),previousRows)
    return FinancialInsights(month, rows.filter { it.kind == EntryKind.INCOME }.sumOf { it.amountCents }, spending.sumOf { it.amountCents },
        (0 until count).map { offset -> val date=start.plusDays(offset.toLong()); DailyAmount(date,days[date].orEmpty().sumOf { it.amountCents }) },
        spending.groupBy { it.categoryName ?: "Sans catégorie" }.map { (name, values) -> CategoryAmount(name,values.sumOf { it.amountCents }) }.sortedByDescending { it.cents },
        rows.sortedByDescending { it.entryDate }.take(5),
        previous.expenseCents.takeIf { previousRows.isNotEmpty() && period == InsightPeriod.MONTH },
        previous.incomeCents.takeIf { previousRows.isNotEmpty() && period == InsightPeriod.MONTH })
}
