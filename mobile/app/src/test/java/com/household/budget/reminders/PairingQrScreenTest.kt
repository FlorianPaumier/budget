package com.household.budget.reminders

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import com.household.budget.ui.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class PairingQrScreenTest {
    @get:Rule val compose = createComposeRule()
    @Test fun `malformed QR payload shows a readable error`() {
        compose.setContent { PairingScreen(PairingUiState(), {}, { _, _, _ -> }, { success, _ -> success("budget://pair?server=bad url") }) }
        compose.onNodeWithText("Scanner le QR de connexion").performScrollTo().performClick()
        compose.onNodeWithText("Ce QR ne contient pas un code de connexion valide.").assertExists()
    }
    @Test fun `camera result fills trusted payload fields but waits for explicit pairing`() {
        var paired = false
        compose.setContent { PairingScreen(PairingUiState(), {}, { _, _, _ -> paired = true }, { success, _ -> success("budget://pair?server=https%3A%2F%2Fnew.home&code=" + "a".repeat(32)) }) }
        compose.onNodeWithText("Scanner le QR de connexion").performScrollTo().performClick()
        compose.onNodeWithText("Adresse du serveur").assertTextContains("https://new.home")
        compose.onNodeWithText("Code de connexion").assertTextContains("a".repeat(32))
        assertFalse(paired)
    }
}
