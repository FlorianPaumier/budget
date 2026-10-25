package com.household.budget.household

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class HouseholdScreensTest {
    @get:Rule val compose = createComposeRule()
    @Test fun categoryCreationUsesExplicitSave() {
        var created: String? = null
        compose.setContent { HouseholdManagementScreen(emptyList(), emptyList(), true, null, { created = it }, { _, _, _ -> }, {}, { _, _ -> }, {}, {}, {}) }
        compose.onNodeWithText("Nom de la catégorie").performTextInput("Groceries")
        compose.runOnIdle { assertNull(created) }
        compose.onNodeWithText("Ajouter une catégorie").performClick()
        compose.runOnIdle { assertEquals("Groceries", created) }
    }
    @Test fun revokeRequiresExplicitConfirmation() {
        var revoked: String? = null
        compose.setContent { HouseholdManagementScreen(emptyList(), listOf(PhoneRow("phone", "Kitchen", "2026-10-01", null)), true, null, {}, { _, _, _ -> }, {}, { _, _ -> }, { revoked = it }, {}, {}) }
        compose.onNodeWithText("Déconnecter Kitchen").performScrollTo().performClick()
        compose.runOnIdle { assertNull(revoked) }
        compose.onNodeWithText("Déconnecter ce téléphone").performClick()
        compose.runOnIdle { assertEquals("phone", revoked) }
    }
    @Test fun historyShowsDeviceTimestampAndBeforeAfter() {
        compose.setContent { EntryHistoryScreen(listOf(HistoryRow("event", "Kitchen", "2026-10-01T12:00:00Z", "{\"amountCents\":100}", "{\"amountCents\":200}")), {}) }
        compose.onNodeWithText("Kitchen · 2026-10-01T12:00:00Z").assertExists()
        compose.onNodeWithText("Avant : 1,00 $").assertExists()
        compose.onNodeWithText("Après : 2,00 $").assertExists()
    }
}
