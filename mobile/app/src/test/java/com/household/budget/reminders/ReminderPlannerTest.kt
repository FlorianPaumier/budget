package com.household.budget.reminders

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId

class ReminderPlannerTest {
    private val zone = ZoneId.of("America/Toronto")

    @Test fun `previous day and due day use household hour across spring daylight saving change`() {
        val reminders = planReminders(
            listOf(ReminderOccurrence("rent", "Rent", LocalDate.parse("2026-03-08"), confirmed = false)),
            LocalTime.of(9, 0), zone, Instant.parse("2026-03-06T12:00:00Z"),
        )
        assertEquals(listOf(Instant.parse("2026-03-07T14:00:00Z"), Instant.parse("2026-03-08T13:00:00Z")), reminders.map { it.at })
        assertEquals(listOf("rent:before", "rent:due"), reminders.map { it.key })
    }

    @Test fun `confirmed items have no pending notifications`() {
        assertEquals(emptyList<ScheduledReminder>(), planReminders(
            listOf(ReminderOccurrence("rent", "Rent", LocalDate.parse("2026-10-07"), confirmed = true)),
            LocalTime.of(9, 0), zone, Instant.parse("2026-10-05T12:00:00Z"),
        ))
    }

    @Test fun `expired reminders are not replayed when a phone reconnects`() {
        val reminders = planReminders(
            listOf(ReminderOccurrence("bill", "Internet", LocalDate.parse("2026-10-05"), confirmed = false)),
            LocalTime.of(9, 0), zone, Instant.parse("2026-10-05T14:00:00Z"),
        )
        assertEquals(emptyList<ScheduledReminder>(), reminders)
    }

    @Test fun `due day stays scheduled when previous day has passed`() {
        val reminders = planReminders(
            listOf(ReminderOccurrence("bill", "Internet", LocalDate.parse("2026-10-06"), confirmed = false)),
            LocalTime.of(9, 0), zone, Instant.parse("2026-10-05T14:00:00Z"),
        )
        assertEquals(listOf(Instant.parse("2026-10-06T13:00:00Z")), reminders.map { it.at })
    }
}
