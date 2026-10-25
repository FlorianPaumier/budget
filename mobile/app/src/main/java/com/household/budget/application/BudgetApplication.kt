package com.household.budget.application

import android.app.Application

class BudgetApplication : Application() {
    val graph: BudgetGraph by lazy { BudgetGraph(this).also { it.startReminderWatch() } }
}
