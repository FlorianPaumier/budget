package com.household.budget.reminders

import android.app.AlarmManager
import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.shadows.ShadowAlarmManager
import java.time.Instant

@RunWith(RobolectricTestRunner::class)
class ReminderSchedulerTest {
    private lateinit var context: Context
    private lateinit var alarms: AlarmManager
    @Before fun setup() {
        context = ApplicationProvider.getApplicationContext()
        alarms = context.getSystemService(AlarmManager::class.java)
        context.getSharedPreferences("reminder_schedule", Context.MODE_PRIVATE).edit().clear().commit()
        ShadowAlarmManager.setCanScheduleExactAlarms(true)
    }

    @Test fun `schedules persistent alarm intents at planned instant`() {
        val scheduler = ReminderScheduler(context)
        val reminder = ScheduledReminder("rent:due", Instant.parse("2026-10-07T13:00:00Z"), "Rent", true)
        assertTrue(scheduler.replace(listOf(reminder)))
        val scheduled = shadowOf(alarms).scheduledAlarms
        assertEquals(1, scheduled.size)
        assertEquals(1791378000000L, scheduled.single().triggerAtTime)
    }

    @Test fun `confirmation cancels old alarm after scheduler recreation`() {
        ReminderScheduler(context).replace(listOf(ScheduledReminder("rent:due", Instant.parse("2026-10-07T13:00:00Z"), "Rent", true)))
        assertEquals(1, shadowOf(alarms).scheduledAlarms.size)
        ReminderScheduler(context).replace(emptyList())
        assertEquals(0, shadowOf(alarms).scheduledAlarms.size)
    }

    @Test fun `reboot restores future cached schedule without network`() {
        val scheduler = ReminderScheduler(context)
        scheduler.replace(listOf(ScheduledReminder("rent:due", Instant.parse("2026-10-07T13:00:00Z"), "Rent", true)))
        shadowOf(alarms).scheduledAlarms.toList().forEach { alarms.cancel(checkNotNull(it.operation)) }
        assertTrue(ReminderScheduler(context).restore(Instant.parse("2026-10-06T12:00:00Z")))
        assertEquals(1, shadowOf(alarms).scheduledAlarms.size)
    }

    @Test fun `denied exact alarm access returns action required instead of crashing`() {
        ShadowAlarmManager.setCanScheduleExactAlarms(false)
        val result = ReminderScheduler(context).replace(listOf(ScheduledReminder("rent:due", Instant.parse("2026-10-07T13:00:00Z"), "Rent", true)))
        assertFalse(result)
        assertEquals(0, shadowOf(alarms).scheduledAlarms.size)
    }
}
