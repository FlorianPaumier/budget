package com.household.budget.reminders

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import com.household.budget.ui.ReminderSettingsScreen
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class ReminderSettingsScreenTest {
    @get:Rule val compose = createComposeRule()
    @Test fun `shared hour edits are explicit and invalid times cannot save`() {
        var saved: String? = null
        compose.setContent { ReminderSettingsScreen("09:00", false, false, false, { saved = it }, {}, {}) }
        compose.onNodeWithText("Heure des rappels (HH:mm)").performTextReplacement("25:00")
        compose.onNodeWithText("Enregistrer l’heure").assertIsNotEnabled()
        compose.onNodeWithText("Heure des rappels (HH:mm)").performTextReplacement("18:30")
        compose.onNodeWithText("Enregistrer l’heure").performClick()
        assertEquals("18:30", saved)
        compose.onNodeWithText("Autoriser les notifications").assertExists()
        compose.onNodeWithText("Autoriser les rappels précis").assertExists()
    }
}
