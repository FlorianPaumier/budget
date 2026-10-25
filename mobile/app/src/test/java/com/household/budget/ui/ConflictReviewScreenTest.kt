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
class ConflictReviewScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test fun showsBothVersionsIncludingDeletionAndRoutesExplicitChoice() {
        var resolution: Pair<String, ConflictChoice>? = null
        compose.setContent {
            ConflictReviewScreen(
                conflicts = listOf(ConflictRow("conflict-1", "monthly_estimate", "estimate-1",
                    serverValueJson = null,
                    proposedValueJson = """{"action":"delete","entityId":"estimate-1","value":null}""")),
                isBusy = false,
                onResolve = { id, choice -> resolution = id to choice },
            )
        }
        compose.onNodeWithText("Supprimé dans le foyer").assertExists()
        compose.onNodeWithText("Suppression proposée").assertExists()
        compose.onNodeWithText("Garder ma modification").performScrollTo().performClick()
        compose.runOnIdle { assertEquals("conflict-1" to ConflictChoice.PROPOSED, resolution) }
    }
}
