package com.household.budget.application

import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import com.household.budget.MainActivity
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class BudgetActivityTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()
    @Test fun `unpaired phone opens setup instead of an empty budget`() {
        compose.onNodeWithText("Connecter ce téléphone").assertExists()
        compose.onNodeWithText("Tester la connexion").assertExists()
    }
}
