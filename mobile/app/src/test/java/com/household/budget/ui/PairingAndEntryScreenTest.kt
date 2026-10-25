package com.household.budget.ui

import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class PairingAndEntryScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test fun pairingUsesHttpsHomeHostAndSubmitsEnteredCodeAndLabel() {
        var submission: Triple<String, String, String>? = null
        compose.setContent {
            PairingScreen(PairingUiState(), onTestConnection = {}, onPair = { host, label, code ->
                submission = Triple(host, label, code)
            })
        }
        compose.onNodeWithText("Nom de ce téléphone").performTextInput("Kitchen phone")
        compose.onNodeWithText("Code de connexion").performTextInput("123456")
        compose.onNodeWithText("Connecter le téléphone").performClick()
        assertEquals(Triple("https://192.168.40.71", "Kitchen phone", "123456"), submission)
    }

    @Test fun pairingBusyStateDisablesSubmissionAndShowsError() {
        compose.setContent {
            PairingScreen(PairingUiState(isBusy = true, error = "Connexion impossible"),
                onTestConnection = {}, onPair = { _, _, _ -> })
        }
        compose.onNodeWithText("Connexion…").assertIsNotEnabled()
        compose.onNodeWithText("Connexion impossible").assertExists()
    }

    @Test fun entryEditorOnlySubmitsValidDraft() {
        val category = EntryCategory("33333333-3333-4333-8333-333333333333", "Groceries")
        var saved: EntryDraft? = null
        compose.setContent {
            EntryEditor(
                initial = EntryDraft(EntryKind.EXPENSE, "2026-10-05", "12.50", categoryId = category.id),
                categories = listOf(category), onSave = { saved = it }, onCancel = {},
            )
        }
        compose.onNodeWithText("Enregistrer").performClick()
        compose.runOnIdle {
            assertEquals(EntryKind.EXPENSE, saved?.kind)
            assertEquals(1250L, parseCadCents(saved?.amountCad.orEmpty()))
        }
    }

    @Test fun editingLocksKindAndBusyDisablesSave() {
        compose.setContent {
            EntryEditor(
                initial = EntryDraft(EntryKind.EXPENSE, "2026-10-05", "12.50",
                    categoryId = "33333333-3333-4333-8333-333333333333"),
                categories = listOf(EntryCategory("33333333-3333-4333-8333-333333333333", "Groceries")),
                onSave = {}, onCancel = {}, isEditing = true, isBusy = true,
            )
        }
        compose.onNodeWithText("Revenu").assertIsNotEnabled()
        compose.onNodeWithText("Enregistrement…").assertIsNotEnabled()
    }
}
