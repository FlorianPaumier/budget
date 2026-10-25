package com.household.budget.reminders

import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId

data class ReminderOccurrence(val id: String, val name: String, val dueDate: LocalDate, val confirmed: Boolean)
data class ScheduledReminder(val key: String, val at: Instant, val name: String, val dueToday: Boolean)

fun planReminders(
    occurrences: List<ReminderOccurrence>,
    hour: LocalTime,
    zone: ZoneId,
    now: Instant,
): List<ScheduledReminder> = occurrences.filterNot { it.confirmed }.flatMap { occurrence ->
    listOf(
        ScheduledReminder("${occurrence.id}:before", occurrence.dueDate.minusDays(1).atTime(hour).atZone(zone).toInstant(), occurrence.name, false),
        ScheduledReminder("${occurrence.id}:due", occurrence.dueDate.atTime(hour).atZone(zone).toInstant(), occurrence.name, true),
    )
}.filter { it.at.isAfter(now) }.sortedBy { it.at }
