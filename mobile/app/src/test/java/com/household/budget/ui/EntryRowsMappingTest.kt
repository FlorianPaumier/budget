package com.household.budget.ui

import com.household.budget.data.local.LedgerEntryEntity
import com.household.budget.data.local.PendingOperationEntity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class EntryRowsMappingTest {
    @Test fun localRowsMarkPendingAndBlockCorrectionsUntilAccepted() {
        val row = LedgerEntryEntity("entry-1", "expense", "2026-10-05", 1250,
            "category-1", null, "Lunch", null, 0, null)
        val pending = PendingOperationEntity("op-1", "entry-1", "ledger_entry", "create",
            0, null, "2026-10-05T10:00:00Z")
        val mapped = entryRowsFromCache(listOf(row), listOf(EntryCategory("category-1", "Food")), listOf(pending))
        assertEquals("Food", mapped.single().categoryName)
        assertTrue(mapped.single().pending)
        assertFalse(mapped.single().canCorrect)
    }

    @Test fun occurrenceLinkedEntriesCannotBeCorrectedDirectly() {
        val row = LedgerEntryEntity("entry-2", "income", "2026-10-05", 200000,
            null, null, "Pay", "occurrence-1", 1, null)
        val mapped = entryRowsFromCache(listOf(row), emptyList(), emptyList())
        assertFalse(mapped.single().canCorrect)
    }
}
