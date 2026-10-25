package com.household.budget.ui

import androidx.compose.ui.test.*
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.createComposeRule
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class DailyUxTest {
    @get:Rule val compose = createComposeRule()

    @Test fun expenseCanBeSavedWithoutOpeningAdvancedOptions() {
        val category = EntryCategory("33333333-3333-4333-8333-333333333333", "Groceries")
        var saved: EntryDraft? = null
        compose.setContent {
            EntryEditor(EntryDraft(EntryKind.EXPENSE, "2026-10-10", ""), listOf(category), { saved = it }, {})
        }
        compose.onNodeWithText("Montant ($ CA)").performTextInput("24,50")
        compose.onNodeWithText("Groceries").performScrollTo().performClick()
        compose.onNodeWithText("Enregistrer").assertIsDisplayed().performClick()
        assertEquals("2026-10-10", saved?.entryDate)
        assertEquals("24,50", saved?.amountCad)
        compose.onNodeWithText("Ajustement de solde").assertDoesNotExist()
    }

    @Test fun deletionRequiresExplicitConfirmationAndCancellationKeepsEntry() {
        var deleted: String? = null
        compose.setContent {
            EntriesScreen(listOf(EntryRow("one", "2026-10-10", EntryKind.EXPENSE, 2450, "Groceries", "Weekly groceries", false)),
                true, {}, {}, { deleted = it })
        }
        compose.onNodeWithText("Supprimer").assertDoesNotExist()
        compose.onNodeWithText("Weekly groceries").performClick()
        compose.onNodeWithText("Supprimer").performScrollTo().performClick()
        assertNull(deleted)
        compose.onNodeWithText("Conserver la transaction").performClick()
        assertNull(deleted)
        compose.onNodeWithText("Supprimer").performScrollTo().performClick()
        compose.onNodeWithText("Supprimer la transaction").performClick()
        assertEquals("one", deleted)
    }
    @Test fun draftSurvivesRestorationAndCancelRequiresConfirmation() {
        val restoration = StateRestorationTester(compose)
        var canceled = false
        restoration.setContent {
            EntryEditor(EntryDraft(EntryKind.INCOME, "2026-10-10", ""), emptyList(), {}, { canceled = true }, asBottomSheet = true)
        }
        compose.onNodeWithText("Montant ($ CA)").performTextInput("123,45")
        restoration.emulateSavedInstanceStateRestore()
        compose.onNodeWithText("Montant ($ CA)").assertTextContains("123,45")
        compose.onNodeWithText("Annuler").performClick()
        assertFalse(canceled)
        compose.onNodeWithText("Continuer la saisie").performClick()
        assertFalse(canceled)
        compose.onNodeWithText("Annuler").performClick()
        compose.onNodeWithText("Quitter").performClick()
        assertTrue(canceled)
    }
    @Test fun editorDrawerKeepsDraftWhenSwipeDismissalIsCanceled() {
        var canceled = false
        compose.setContent {
            EntryEditor(EntryDraft(EntryKind.INCOME, "2026-10-10", ""), emptyList(), {},
                { canceled = true }, asBottomSheet = true)
        }
        compose.onNode(isDialog()).assertExists()
        compose.onNodeWithText("Montant ($ CA)").performTextInput("123,45")
        compose.onNodeWithTag("entry-editor-drawer").performTouchInput { swipeDown() }
        compose.waitForIdle()
        compose.onNodeWithText("Quitter sans enregistrer ?").assertExists()
        assertFalse(canceled)
        compose.onNodeWithText("Continuer la saisie").performClick()
        compose.onNodeWithText("Montant ($ CA)").assertTextContains("123,45")
        compose.onNodeWithText("Annuler").performScrollTo().performClick()
        compose.onNodeWithText("Quitter").performClick()
        assertTrue(canceled)
    }

    @Test fun editDrawerSavesChangedAmountAndKeepsTransactionType() {
        val initial = EntryDraft(EntryKind.INCOME, "2026-10-10", "12.34", note = "Salaire")
        var saved: EntryDraft? = null
        compose.setContent {
            EntryEditor(initial, emptyList(), { saved = it }, {}, isEditing = true, asBottomSheet = true)
        }
        compose.onNodeWithText("Dépense").assertIsNotEnabled()
        compose.onNodeWithText("Montant ($ CA)").performTextReplacement("15,50")
        compose.onNodeWithText("Enregistrer").assertIsDisplayed().performClick()
        assertEquals(initial.copy(amountCad = "15,50"), saved)
    }

    @Test fun busyDrawerCannotBeDismissedUntilSaveFinishes() {
        val busy = mutableStateOf(true)
        var canceled = false
        compose.setContent {
            EntryEditor(EntryDraft(EntryKind.INCOME, "2026-10-10", ""), emptyList(), {},
                { canceled = true }, isBusy = busy.value, asBottomSheet = true)
        }
        compose.onNodeWithTag("entry-editor-drawer").performTouchInput { swipeDown() }
        compose.waitForIdle()
        assertFalse(canceled)
        compose.onNodeWithText("Enregistrement…").assertIsNotEnabled()
        compose.runOnIdle { busy.value = false }
        compose.onNodeWithTag("entry-editor-drawer").performTouchInput { swipeDown() }
        compose.waitForIdle()
        assertTrue(canceled)
    }

}
