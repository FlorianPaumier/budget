package com.household.budget.application

import com.household.budget.ui.EstimateRow
import java.time.YearMonth

data class MonthPlanState(val month: YearMonth, val estimates: List<EstimateRow> = emptyList(), val savingsTargetCents: Long? = null)
