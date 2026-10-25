package com.household.budget.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class EntryDraftTest {
    private val category = "33333333-3333-4333-8333-333333333333"

    @Test fun decimalCadAmountConvertsExactlyToIntegerCents() {
        assertEquals(1250L, parseCadCents("12.50"))
        assertEquals(-105L, parseCadCents("-1.05"))
        assertEquals(null, parseCadCents("1.005"))
        assertEquals(null, parseCadCents("1e2"))
    }

    @Test fun unsafeBackendIntegerAmountIsRejectedLocally() {
        assertFalse(validateEntryDraft(EntryDraft(EntryKind.INCOME, "2026-10-05", "90071992547409.92")).isValid)
        assertTrue(validateEntryDraft(EntryDraft(EntryKind.INCOME, "2026-10-05", "90071992547409.91")).isValid)
    }

    @Test fun expenseRequiresCategoryAndPositiveNonzeroAmount() {
        val draft = EntryDraft(EntryKind.EXPENSE, "2026-10-05", "12.50")
        assertFalse(validateEntryDraft(draft).isValid)
        assertTrue(validateEntryDraft(draft.copy(categoryId = category)).isValid)
        assertFalse(validateEntryDraft(draft.copy(categoryId = category, amountCad = "-1")).isValid)
    }

    @Test fun adjustmentRequiresAccountAndTransferForbidsCategory() {
        val balance = EntryDraft(EntryKind.BALANCE_ADJUSTMENT, "2026-10-05", "-1.05")
        assertFalse(validateEntryDraft(balance).isValid)
        assertTrue(validateEntryDraft(balance.copy(account = EntryAccount.SAVINGS)).isValid)
        val transfer = EntryDraft(EntryKind.SAVINGS_TRANSFER, "2026-10-05", "10.00", categoryId = category)
        assertFalse(validateEntryDraft(transfer).isValid)
    }

    @Test fun rejectsInvalidCalendarDateAndOverlongNote() {
        val draft = EntryDraft(EntryKind.INCOME, "2026-02-30", "1.00", note = "x".repeat(501))
        assertFalse(validateEntryDraft(draft).isValid)
    }

    @Test fun createPayloadMatchesOpenApiAndPreservesSignedCents() {
        val draft = EntryDraft(EntryKind.BALANCE_ADJUSTMENT, "2026-10-05", "-1.05",
            account = EntryAccount.SAVINGS, note = "Correction")
        val payload = entryDraftToJson(draft)
        assertEquals("balance_adjustment", payload.getString("kind"))
        assertEquals("2026-10-05", payload.getString("entryDate"))
        assertEquals(-105L, payload.getLong("amountCents"))
        assertEquals("savings", payload.getString("account"))
        assertEquals("Correction", payload.getString("note"))
        assertFalse(payload.has("categoryId"))
    }
    @Test fun frenchDecimalInputKeepsExactCents() {
        assertEquals(2450L, parseCadCents("24,50"))
        assertEquals(-105L, parseCadCents("-1,05"))
        assertEquals(null, parseCadCents("1,005"))
        assertEquals(null, parseCadCents("1,234.50"))
        assertEquals(null, parseCadCents("1.234,50"))
    }
}
