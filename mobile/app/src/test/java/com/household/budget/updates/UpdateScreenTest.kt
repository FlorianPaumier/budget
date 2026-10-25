package com.household.budget.updates
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import org.junit.Rule
import org.junit.Test
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.io.File
@RunWith(RobolectricTestRunner::class)
class UpdateScreenTest {
    @get:Rule val compose = createComposeRule()
    @Test fun onlyVerifiedReadyStateOffersInstall() {
        var installed = false
        compose.setContent { UpdateScreen(UpdateCheck.Ready("0.2.0", File("verified.apk")), false, {}, { installed = true }) }
        compose.onNodeWithText("Installer la mise à jour").performClick()
        assertTrue(installed)
    }
}
