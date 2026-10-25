package com.household.budget.recurring

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.hasScrollToIndexAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTextClearance
import androidx.compose.ui.test.performTextInput
import com.household.budget.data.local.OccurrenceEntity
import com.household.budget.data.local.PendingOperationEntity
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class RecurringScreenTest {
    @get:Rule val compose = createComposeRule()
    @Test fun queuedRuleDeletionBlocksExpectedConfirmationButPreservesConfirmedHistory() {
        compose.setContent {
            val expected = OccurrenceEntity("expected", "rule", "Supprimée rent", "bill", "2026-10-07", 100,
                "expected", null, null, null, false, 1, null)
            RecurringScreen(emptyList(), listOf(expected, expected.copy(id = "changed", ruleId = "changed-rule", ruleName = "Changed rent"), expected.copy(id = "confirmed", ruleName = "Paid rent", status = "confirmed",
                actualDate = "2026-10-06", actualAmountCents = 100)),
                listOf(PendingOperationEntity("delete", "rule", "recurring_rule", "delete", 1, null, "2026-10-06T12:00:00Z"),
                    PendingOperationEntity("update", "changed-rule", "recurring_rule", "update", 1, "{\"name\":\"New rent\"}", "2026-10-06T12:01:00Z")),
                emptyList(), "2026-10-06", true, false, onSaveRule = { _, _, _ -> },
                onDeleteRule = { _, _ -> }, onConfirm = { _, _, _, _ -> })
        }
        val list = compose.onNode(hasScrollToIndexAction())
        list.performScrollToNode(hasText("Supprimée rent"))
        compose.onNodeWithText("Confirmer").assertDoesNotExist()
        list.performScrollToNode(hasText("Changed rent"))
        compose.onNodeWithText("Confirmer").assertDoesNotExist()
        list.performScrollToNode(hasText("Corriger la confirmation"))
        compose.onNodeWithText("Corriger la confirmation").performClick()
        compose.onNodeWithText("Date réelle (AAAA-MM-JJ)").assertExists()
    }
    @Test fun expectedOccurrenceConfirmationAllowsCorrectedDateAndAmount() {
        var saved: List<Any>? = null
        compose.setContent {
            RecurringScreen(emptyList(), listOf(OccurrenceEntity("occ", "rule", "Pay", "income", "2026-10-01", 200000,
                "expected", null, null, null, false, 7, null)), emptyList(), emptyList(), "2026-10-06", true, false,
                onSaveRule = { _, _, _ -> }, onDeleteRule = { _, _ -> },
                onConfirm = { id, rev, date, cents -> saved = listOf(id, rev, date, cents) })
        }
        compose.onNodeWithText("En retard").assertExists()
        compose.onNodeWithText("Confirmer").performClick()
        compose.onNodeWithText("Date réelle (AAAA-MM-JJ)").performTextClearance()
        compose.onNodeWithText("Date réelle (AAAA-MM-JJ)").performTextInput("2026-10-05")
        compose.onNodeWithText("Montant réel ($ CA)").performTextClearance()
        compose.onNodeWithText("Montant réel ($ CA)").performTextInput("2015.75")
        compose.onNodeWithText("Enregistrer la confirmation").performClick()
        compose.runOnIdle { assertEquals(listOf("occ", 7L, "2026-10-05", 201575L), saved) }
    }
    @Test fun newRuleShowsPreviewAndSavesDraft() {
        var saved: RecurringDraft? = null
        compose.setContent {
            RecurringScreen(emptyList(), emptyList(), emptyList(), emptyList(), "2026-10-06", true, false,
                onSaveRule = { draft, _, _ -> saved = draft }, onDeleteRule = { _, _ -> }, onConfirm = { _, _, _, _ -> })
        }
        compose.onNodeWithText("Ajouter une opération régulière").performClick()
        compose.onNodeWithText("Nom").performTextInput("Rent")
        compose.onNodeWithText("Montant ($ CA)").performTextInput("1250.25")
        compose.onNodeWithText("Prochaines échéances").assertExists()
        compose.onNodeWithText("Enregistrer").performScrollTo().performClick()
        compose.runOnIdle { assertEquals("Rent", saved?.name); assertEquals("1250.25", saved?.amountCad) }
    }
}
