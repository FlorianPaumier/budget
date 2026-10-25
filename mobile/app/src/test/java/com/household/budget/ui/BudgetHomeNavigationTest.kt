package com.household.budget.ui

import androidx.compose.material3.Text
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeLeft
import androidx.compose.ui.test.swipeRight
import org.junit.Assert.assertEquals
import java.time.YearMonth
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.time.Instant
import java.time.ZoneId

@RunWith(RobolectricTestRunner::class)
class BudgetHomeNavigationTest {
    @get:Rule val compose = createComposeRule()

    @Test fun entryTabRendersSuppliedLocalContent() {
        compose.setContent {
            BudgetHome(
                state = MonthDashboardState.empty(ZoneId.of("America/Toronto"), Instant.parse("2026-10-05T12:00:00Z")),
                onMonthSelected = {}, onAddEntry = {},
                entriesContent = { Text("Local entry row") },
                planContent = { Text("Local estimate row") },
            )
        }
        compose.onNodeWithText("Transactions").performClick()
        compose.onNodeWithText("Local entry row").assertExists()
        compose.onNodeWithText("Budget").performClick()
        compose.onNodeWithText("Local estimate row").assertExists()
    }
    @Test fun monthSupportsButtonsAndHorizontalSwipes() {
        val month = YearMonth.of(2026,10)
        var selected = month
        compose.setContent {
            BudgetTheme {
                BudgetHome(MonthDashboardState.empty(ZoneId.of("America/Toronto")).copy(selectedMonth = month),
                    onMonthSelected = { selected = it }, onAddEntry = {})
            }
        }
        compose.onNodeWithContentDescription("Mois suivant").performClick()
        assertEquals(month.plusMonths(1), selected)
        compose.onNodeWithContentDescription("Mois précédent").performClick()
        assertEquals(month.minusMonths(1), selected)
        compose.onRoot().performTouchInput { swipeLeft() }
        assertEquals(month.plusMonths(1), selected)
        compose.onRoot().performTouchInput { swipeRight() }
        assertEquals(month.minusMonths(1), selected)
    }
}
