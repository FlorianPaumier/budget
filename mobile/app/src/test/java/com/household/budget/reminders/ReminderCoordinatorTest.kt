package com.household.budget.reminders

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.household.budget.data.local.*
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.time.*

@RunWith(RobolectricTestRunner::class)
class ReminderCoordinatorTest {
    @Test fun `cached bills survive offline and confirmation cancels reminders`() = runTest {
        val db = Room.inMemoryDatabaseBuilder(ApplicationProvider.getApplicationContext(), BudgetDatabase::class.java).allowMainThreadQueries().build()
        try {
            db.budgetDao().upsertHousehold(HouseholdEntity("home", "CAD", "America/Toronto", "09:00", 0, 0, "2026-01-01", null, 1))
            val rule = RecurringRuleEntity("rule", "bill", "Rent", null, 100, "monthly", 1, "2026-01-01", null, null, true, 1, null)
            db.budgetDao().upsertRules(listOf(rule))
            val bill = OccurrenceEntity("rent", "rule", "Rent", "bill", "2026-10-07", 100, "expected", null, null, null, false, 1, null)
            db.budgetDao().upsertOccurrences(listOf(bill))
            var scheduled = emptyList<ScheduledReminder>()
            val coordinator = ReminderCoordinator(db, Clock.fixed(Instant.parse("2026-10-06T12:00:00Z"), ZoneOffset.UTC)) { scheduled = it; true }
            assertTrue(coordinator.reschedule())
            assertEquals(2, scheduled.size)
            assertEquals(Instant.parse("2026-10-06T13:00:00Z"), scheduled.first().at)
            db.budgetDao().upsertPending(PendingOperationEntity("hour", "home", "household", "update", 1, "{\"reminderTime\":\"18:30\"}", "2026-10-06T12:00:00Z"))
            coordinator.reschedule()
            assertEquals(Instant.parse("2026-10-06T22:30:00Z"), scheduled.first().at)
            db.budgetDao().upsertPending(PendingOperationEntity("confirm", "rent", "occurrence", "update", 1, "{}", "2026-10-06T12:01:00Z"))
            coordinator.reschedule()
            assertTrue(scheduled.isEmpty())
            db.budgetDao().deletePending("confirm")
            db.budgetDao().upsertOccurrences(listOf(bill.copy(status = "confirmed")))
            coordinator.reschedule()
            assertTrue(scheduled.isEmpty())
            db.budgetDao().upsertOccurrences(listOf(bill))
            db.budgetDao().upsertPending(PendingOperationEntity("schedule", "rule", "recurring_rule", "update", 1, "{\"frequency\":\"daily\"}", "2026-10-06T12:09:00Z"))
            coordinator.reschedule()
            assertTrue("Queued schedule changes must not notify using stale dates", scheduled.isEmpty())
            db.budgetDao().deletePending("schedule")
            db.budgetDao().upsertRules(listOf(rule.copy(deletedAt = "2026-10-06T12:10:00Z")))
            coordinator.reschedule()
            assertTrue("Supprimée rule must not resurrect reminders from cached occurrences", scheduled.isEmpty())
        } finally { db.close() }
    }
    @Test fun `expected income also receives household reminders`() = runTest {
        val db = Room.inMemoryDatabaseBuilder(ApplicationProvider.getApplicationContext(), BudgetDatabase::class.java).allowMainThreadQueries().build()
        try {
            db.budgetDao().upsertHousehold(HouseholdEntity("home", "CAD", "America/Toronto", "09:00", 0, 0, "2026-01-01", null, 1))
            db.budgetDao().upsertRules(listOf(RecurringRuleEntity("pay", "income", "Salary", null, 100, "monthly", 1, "2026-01-01", null, null, true, 1, null)))
            db.budgetDao().upsertOccurrences(listOf(OccurrenceEntity("salary", "pay", "Salary", "income", "2026-10-07", 100, "expected", null, null, null, false, 1, null)))
            var scheduled = emptyList<ScheduledReminder>()
            ReminderCoordinator(db, Clock.fixed(Instant.parse("2026-10-06T12:00:00Z"), ZoneOffset.UTC)) { scheduled = it; true }.reschedule()
            assertEquals(2, scheduled.size)
        } finally { db.close() }
    }
    @Test fun `revoked phone clears alarms without deleting cache`() = runTest {
        val db = Room.inMemoryDatabaseBuilder(ApplicationProvider.getApplicationContext(), BudgetDatabase::class.java).allowMainThreadQueries().build()
        try {
            var called = false
            val coordinator = ReminderCoordinator(db, Clock.systemUTC()) { assertTrue(it.isEmpty()); called = true; true }
            assertTrue(coordinator.reschedule(false))
            assertTrue(called)
        } finally { db.close() }
    }
}
