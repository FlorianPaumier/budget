package com.household.budget.ui

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class EntriesScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test fun showsLocalEntryAndRoutesCorrectionByStableId() {
        var edited: String? = null
        compose.setContent {
            EntriesScreen(
                entries = listOf(EntryRow("entry-1", "2026-10-05", EntryKind.EXPENSE,
                    1250, "Groceries", "Lunch", pending = true)),
                canEdit = true, onAdd = {}, onEdit = { edited = it }, onDelete = {},
            )
        }
        compose.onNodeWithText("Lunch").assertExists()
        compose.onNodeWithText("À synchroniser").assertExists()
        compose.onNodeWithText("Lunch").performClick()
        compose.onNodeWithText("Modifier").performScrollTo().performClick()
        compose.runOnIdle { assertEquals("entry-1", edited) }
    }

    @Test fun readOnlyEntriesDoNotExposeCorrections() {
        compose.setContent {
            EntriesScreen(
                entries = listOf(EntryRow("entry-2", "2026-10-04", EntryKind.INCOME,
                    200000, null, "Pay", pending = false)),
                canEdit = false, onAdd = {}, onEdit = {}, onDelete = {},
            )
        }
        compose.onNodeWithText("Pay").assertExists()
        compose.onNodeWithText("Modifier").assertDoesNotExist()
        compose.onNodeWithText("Supprimer").assertDoesNotExist()
    }

    @Test fun occurrenceLinkedEntryHasNoDirectCorrectionActions() {
        compose.setContent {
            EntriesScreen(
                entries = listOf(EntryRow("entry-3", "2026-10-05", EntryKind.EXPENSE,
                    6500, "Utilities", "Power bill", pending = false, canCorrect = false)),
                canEdit = true, onAdd = {}, onEdit = {}, onDelete = {},
            )
        }
        compose.onNodeWithText("Power bill").assertExists()
        compose.onNodeWithText("Modifier").assertDoesNotExist()
        compose.onNodeWithText("Supprimer").assertDoesNotExist()
    }

    @Test fun queuedOfflineEntryShowsEnteredDetailsAndRejection() {
        compose.setContent {
            EntriesScreen(
                entries = emptyList(), canEdit = true, onAdd = {}, onEdit = {}, onDelete = {},
                queued = listOf(PendingEntryRow("op-1", "create", "rejected", "2026-10-05",
                    1250, "Lunch", "invalid_category")),
            )
        }
        compose.onNodeWithText("Lunch").assertExists()
        compose.onNodeWithText("À corriger · invalid_category").assertExists()
    }
}
