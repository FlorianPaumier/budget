package com.household.budget.ui

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextClearance
import androidx.compose.ui.test.performTextInput
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class PlanScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test fun suggestionNeedsExplicitAcceptanceBeforeCallback() {
        var accepted: String? = null
        compose.setContent {
            PlanScreen(
                estimates = listOf(EstimateRow("groceries", "Groceries", 50000, 47500, 5)),
                savingsTargetCents = 20000,
                onEditEstimate = { _, _ -> },
                onAcceptSuggestion = { accepted = it },
                onEditSavingsTarget = {},
            )
        }
        compose.runOnIdle { assertEquals(null, accepted) }
        compose.onNodeWithText("Groceries").assertExists()
        compose.onNodeWithText("5 mois", substring = true).assertExists()
        compose.onNodeWithText("Utiliser la suggestion").performScrollTo().performClick()
        compose.runOnIdle { assertEquals("groceries", accepted) }
    }

    @Test fun editedEstimateSendsIntegerCents() {
        var saved: Pair<String, Long>? = null
        compose.setContent {
            PlanScreen(
                estimates = listOf(EstimateRow("groceries", "Groceries", 50000, null, 0)),
                savingsTargetCents = null,
                onEditEstimate = { id, cents -> saved = id to cents },
                onAcceptSuggestion = {}, onEditSavingsTarget = {},
            )
        }
        compose.onNodeWithText("Modifier le budget").performScrollTo().performClick()
        compose.onNodeWithText("Budget prévu ($ CA)").performTextClearance()
        compose.onNodeWithText("Budget prévu ($ CA)").performTextInput("475.25")
        compose.onNodeWithText("Enregistrer le budget").performScrollTo().performClick()
        compose.runOnIdle { assertEquals("groceries" to 47525L, saved) }
    }

    @Test fun savingsTargetCanBeCleared() {
        var saved: Long? = -1
        compose.setContent {
            PlanScreen(
                estimates = emptyList(), savingsTargetCents = 20000,
                onEditEstimate = { _, _ -> }, onAcceptSuggestion = {},
                onEditSavingsTarget = { saved = it },
            )
        }
        compose.onNodeWithText("Modifier l’objectif d’épargne").performClick()
        compose.onNodeWithText("Retirer l’objectif").performClick()
        compose.runOnIdle { assertEquals(null, saved) }
    }

    @Test fun readOnlyPlanHidesChangeActions() {
        compose.setContent {
            PlanScreen(
                estimates = listOf(EstimateRow("groceries", "Groceries", 50000, 47500, 5)),
                savingsTargetCents = 20000,
                onEditEstimate = { _, _ -> }, onAcceptSuggestion = {},
                onEditSavingsTarget = {}, canEdit = false,
            )
        }
        compose.onNodeWithText("Groceries").assertExists()
        compose.onNodeWithText("Modifier le budget").assertDoesNotExist()
        compose.onNodeWithText("Utiliser la suggestion").assertDoesNotExist()
        compose.onNodeWithText("Modifier l’objectif d’épargne").assertDoesNotExist()
    }
}
