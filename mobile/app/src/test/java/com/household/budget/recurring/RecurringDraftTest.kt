package com.household.budget.recurring

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate

class RecurringDraftTest {
    @Test fun monthlyPreviewKeepsOriginalAnchorAcrossShortMonths() {
        val draft = RecurringDraft("Rent", amountCad = "1250.00", startsOn = "2026-01-31")
        assertEquals(listOf("2026-01-31", "2026-02-28", "2026-03-31"),
            previewRecurringDates(draft, LocalDate.parse("2026-01-01"), LocalDate.parse("2026-03-31")).map { it.toString() })
    }
    @Test fun draftSerializesExactCentsAndExplicitClearingFields() {
        val value = recurringDraftToJson(RecurringDraft(" Rent ", amountCad = "1250.25", startsOn = "2026-01-31"))
        assertEquals("Rent", value.getString("name"))
        assertEquals(125025L, value.getLong("amountCents"))
        org.junit.Assert.assertTrue(value.has("endsOn") && value.isNull("endsOn"))
        org.junit.Assert.assertTrue(value.has("categoryId") && value.isNull("categoryId"))
        org.junit.Assert.assertTrue(value.has("scheduleDetails") && value.isNull("scheduleDetails"))
    }
    @Test fun draftRejectsInvalidMoneyDatesAndTwiceMonthlyDays() {
        val errors = validateRecurringDraft(RecurringDraft(" ", amountCad = "0.001", frequency = "twice_monthly",
            interval = 0, startsOn = "2026-02-30", days = listOf(0, 32)))
        org.junit.Assert.assertTrue(errors.keys.containsAll(listOf("name", "amountCad", "interval", "startsOn", "days")))
    }
    @Test fun expandedYearsAreRejectedToMatchBackendCalendarDateContract() {
        val errors = validateRecurringDraft(RecurringDraft("Rent", amountCad = "100.00", startsOn = "+10000-01-01", endsOn = "+10001-01-01"))
        org.junit.Assert.assertTrue(errors.keys.containsAll(listOf("startsOn", "endsOn")))
    }
}
