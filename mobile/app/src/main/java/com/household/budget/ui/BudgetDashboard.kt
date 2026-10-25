package com.household.budget.ui

import androidx.compose.ui.res.stringResource
import com.household.budget.R
import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.household.budget.application.FinancialInsights
import com.household.budget.application.InsightPeriod
import java.text.NumberFormat
import java.time.Instant
import java.time.YearMonth
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Currency
import java.util.Locale

/** Values are server/Room-derived CAD cents. Null means no local data has been loaded. */
data class MonthDashboardState(
    val householdZoneId: ZoneId,
    val selectedMonth: YearMonth,
    val currentMonth: YearMonth,
    val plannedMoneyLeftCents: Long? = null,
    val actualMoneyLeftTodayCents: Long? = null,
    val spendableCents: Long? = null,
    val savingsCents: Long? = null,
    val combinedCents: Long? = null,
    val incomeCents: Long? = null,
    val spendingCents: Long? = null,
) {
    companion object {
        fun empty(householdZoneId: ZoneId, now: Instant = Instant.now()): MonthDashboardState {
            val month = YearMonth.from(now.atZone(householdZoneId))
            return MonthDashboardState(householdZoneId, month, month)
        }
    }
}

private data class DashboardPage(val state: MonthDashboardState, val insights: FinancialInsights)

enum class BudgetDestination(val label: String) {
    MONTH("Accueil"), ENTRIES("Transactions"), PLAN("Budget"), STATS("Analyse"), PROFILE("Profil")
}

@Composable
fun BudgetHome(
    state: MonthDashboardState,
    onMonthSelected: (YearMonth) -> Unit,
    onAddEntry: () -> Unit,
    canAddEntry: Boolean = false,
    onEntriesSelected: () -> Unit = {},
    onPlanSelected: () -> Unit = {},
    modifier: Modifier = Modifier,
    entriesContent: (@Composable () -> Unit)? = null,
    planContent: (@Composable () -> Unit)? = null,
    insights: FinancialInsights = FinancialInsights(state.selectedMonth),
    profileContent: (@Composable () -> Unit)? = null,
    statistics: FinancialInsights = insights,
    previousDashboard: MonthDashboardState? = null,
    period: InsightPeriod = InsightPeriod.MONTH,
    onPeriodSelected: (InsightPeriod) -> Unit = {},
) {
    val haptics = LocalHapticFeedback.current
    val selectMonth: (YearMonth) -> Unit = { haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove); onMonthSelected(it) }
    var swipe by remember { mutableFloatStateOf(0f) }
    var destination by rememberSaveable { mutableStateOf(BudgetDestination.MONTH) }
    Scaffold(modifier = modifier, containerColor = MaterialTheme.colorScheme.background,
        floatingActionButton = {
            if (canAddEntry && destination != BudgetDestination.PROFILE) ExtendedFloatingActionButton(
                onClick = onAddEntry, containerColor = MaterialTheme.colorScheme.primary,
                icon = { BudgetIcon("add") }, text = { Text(stringResource(R.string.ui_ajouter)) })
        },
        bottomBar = {
            NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                BudgetDestination.entries.forEach { item ->
                    NavigationBarItem(selected = destination == item,
                        onClick = {
                            destination = item
                            when (item) { BudgetDestination.ENTRIES -> onEntriesSelected(); BudgetDestination.PLAN -> onPlanSelected(); else -> Unit }
                        }, icon = { BudgetIcon(when (item) {
                            BudgetDestination.MONTH -> "home"; BudgetDestination.ENTRIES -> "list"
                            BudgetDestination.PLAN -> "wallet"; BudgetDestination.STATS -> "chart"; BudgetDestination.PROFILE -> "person"
                        }) }, label = { Text(item.label, style = MaterialTheme.typography.labelSmall) })
                }
            }
        }) { padding ->
        Column(Modifier.padding(padding).fillMaxSize().pointerInput(state.selectedMonth, destination) {
            if (destination != BudgetDestination.PROFILE) detectHorizontalDragGestures(
                onDragStart = { swipe = 0f }, onDragCancel = { swipe = 0f },
                onDragEnd = { if(kotlin.math.abs(swipe) > 64.dp.toPx()) selectMonth(if(swipe < 0) state.selectedMonth.plusMonths(1) else state.selectedMonth.minusMonths(1)); swipe = 0f },
                onHorizontalDrag = { change, amount -> change.consume(); swipe += amount })
        }) {
            if (destination != BudgetDestination.PROFILE) MonthSlider(state.selectedMonth, state.currentMonth, selectMonth)
            val visibleInsights = if (insights.month == state.selectedMonth) insights else FinancialInsights(state.selectedMonth)
            AnimatedContent(targetState = DashboardPage(state, visibleInsights), contentKey = { it.state.selectedMonth }, label = "month slide", modifier = Modifier.weight(1f).widthIn(max = 840.dp),
                transitionSpec = {
                    val direction = if (targetState.state.selectedMonth > initialState.state.selectedMonth) 1 else -1
                    (slideInHorizontally(tween(BudgetTokens.Motion)) { it * direction } + fadeIn(tween(BudgetTokens.Motion))) togetherWith
                        (slideOutHorizontally(tween(BudgetTokens.Motion)) { -it * direction } + fadeOut(tween(BudgetTokens.Motion)))
                }) { frame ->
                val page = frame.state
                val month = page.selectedMonth
                val data = frame.insights
                when (destination) {
                    BudgetDestination.MONTH -> MonthDashboard(page, onMonthSelected, onAddEntry, canAddEntry, insights = data,
                        onSeeAll = { destination = BudgetDestination.ENTRIES; onEntriesSelected() }, previousDashboard = previousDashboard)
                    BudgetDestination.ENTRIES -> if(month != state.selectedMonth) EmptyState("Changement de mois", "Chargement des transactions…") else entriesContent?.invoke() ?: EmptyState("Aucune transaction", "Ajoutez une première transaction pour suivre votre mois.")
                    BudgetDestination.PLAN -> if(month != state.selectedMonth) EmptyState("Changement de mois", "Chargement du budget…") else planContent?.invoke() ?: EmptyState("Votre budget mensuel", "Fixez un budget par catégorie pour planifier vos dépenses.")
                    BudgetDestination.STATS -> StatisticsScreen(if (statistics.month == month) statistics else FinancialInsights(month), period, onPeriodSelected, page, previousDashboard)
                    BudgetDestination.PROFILE -> profileContent?.invoke() ?: EmptyState("Votre foyer", "Gérez vos préférences ici.")
                }
            }
        }
    }
}

@Composable
fun MonthSlider(month: YearMonth, currentMonth: YearMonth, onSelected: (YearMonth) -> Unit) {
    Column(Modifier.fillMaxWidth().padding(horizontal = BudgetTokens.Page, vertical = 8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            IconButton(onClick = { onSelected(month.minusMonths(1)) }) { BudgetIcon("left", "Mois précédent") }
            Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                Text(month.format(monthFormatter), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Text("${month.minusMonths(1).format(shortMonthFormatter)}  ·  ${month.plusMonths(1).format(shortMonthFormatter)}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            IconButton(onClick = { onSelected(month.plusMonths(1)) }) { BudgetIcon("right", "Mois suivant") }
        }
        if (month != currentMonth) TextButton(onClick = { onSelected(currentMonth) }, modifier = Modifier.align(Alignment.CenterHorizontally)) { Text(stringResource(R.string.ui_revenir_a_ce_mois)) }
    }
}

@Composable
fun MonthDashboard(
    state: MonthDashboardState, onMonthSelected: (YearMonth) -> Unit, onAddEntry: () -> Unit,
    canAddEntry: Boolean = false, modifier: Modifier = Modifier,
    insights: FinancialInsights = FinancialInsights(state.selectedMonth), onSeeAll: () -> Unit = {}, previousDashboard: MonthDashboardState? = null,
) {
    LazyColumn(modifier.fillMaxSize(), contentPadding = PaddingValues(start = BudgetTokens.Page, end = BudgetTokens.Page, top = 8.dp, bottom = 100.dp),
        verticalArrangement = Arrangement.spacedBy(BudgetTokens.Space)) {
        item { Text(stringResource(R.string.ui_vue_densemble), style = MaterialTheme.typography.titleLarge) }
        item { BalanceCard(state.actualMoneyLeftTodayCents, if (state.selectedMonth == state.currentMonth) "Solde disponible" else "Solde en fin de mois") }
        if (previousDashboard?.selectedMonth == state.selectedMonth.minusMonths(1) && previousDashboard.actualMoneyLeftTodayCents != null && state.actualMoneyLeftTodayCents != null) item {
            ComparisonRow("Solde disponible", state.actualMoneyLeftTodayCents, previousDashboard.actualMoneyLeftTodayCents)
        }
        item { FinancialOverview(state, insights) }
        if (state.actualMoneyLeftTodayCents == null) item { EmptyState("Données du mois indisponibles", "Connectez-vous au serveur pour récupérer les montants de ce mois.") }
        item { SectionHeader("Transactions récentes", "Tout voir", onSeeAll) }
        if (insights.recent.isEmpty()) item {
            EmptyState("Aucune transaction ce mois-ci", "Ajoutez une transaction pour commencer à suivre vos dépenses.")
            if (canAddEntry) TextButton(onClick = onAddEntry) { Text(stringResource(R.string.ui_ajouter)) }
        }
        items(insights.recent, key = { it.id }) { TransactionItem(it) }
        if(insights.expenseCents > 0) item { FinancialLineChart(insights.daily) }
        item {
            Card { Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                SectionHeader("Vos comptes")
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text(stringResource(R.string.ui_disponible)); Text(formatCadCents(state.spendableCents)) }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text(stringResource(R.string.ui_total_des_comptes)); Text(formatCadCents(state.combinedCents)) }
                Text(stringResource(R.string.ui_les_soldes_incluent_les_montants_de_depart_et_les_transferts), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            } }
        }
    }
}

@Composable
fun StatisticsScreen(data: FinancialInsights, period: InsightPeriod = InsightPeriod.MONTH, onPeriodSelected: (InsightPeriod) -> Unit = {}, dashboard: MonthDashboardState? = null, previousDashboard: MonthDashboardState? = null) {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp, 8.dp, 20.dp, 100.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        item { Text(stringResource(R.string.ui_comprendre_vos_depenses), style = MaterialTheme.typography.headlineMedium) }
        item { Text("Transactions synchronisées · ${data.month.format(monthFormatter)}", color = MaterialTheme.colorScheme.onSurfaceVariant) }
        item {
            FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                InsightPeriod.entries.forEach { option -> FilterChip(selected = period == option, onClick = { onPeriodSelected(option) }, label = { Text(option.label) }) }
            }
        }
        item { FinancialLineChart(data.daily) }
        item { CategoryDonutChart(data.categories) }
        item { FinancialSummaryCard("Revenus", data.incomeCents, "income", Modifier.fillMaxWidth()) }
        item { FinancialSummaryCard("Dépenses", data.expenseCents, "expense", Modifier.fillMaxWidth()) }
        if (period == InsightPeriod.MONTH) item {
            Card { Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                SectionHeader("Comparaison avec le mois précédent")
                ComparisonRow("Revenus", data.incomeCents, data.previousIncomeCents)
                ComparisonRow("Dépenses", data.expenseCents, data.previousExpenseCents)
                if (dashboard?.savingsCents != null) ComparisonRow("Compte d’épargne", dashboard.savingsCents, previousDashboard?.takeIf { it.selectedMonth == data.month.minusMonths(1) }?.savingsCents)
                Text(stringResource(R.string.ui_calcule_a_partir_des_transactions_synchronisees_le_mois_en_c), style = MaterialTheme.typography.bodySmall)
            } }
        }
    }
}
private val monthFormatter = DateTimeFormatter.ofPattern("LLLL yyyy", Locale.CANADA_FRENCH)
private val shortMonthFormatter = DateTimeFormatter.ofPattern("MMM", Locale.CANADA_FRENCH)

/** Formats integer cents without converting money through a floating-point value. */
fun formatCadCents(cents: Long?): String {
    if (cents == null) return "—"
    val formatter = NumberFormat.getCurrencyInstance(Locale.CANADA_FRENCH)
    formatter.currency = Currency.getInstance("CAD")
    val dollars = java.math.BigDecimal.valueOf(cents, 2)
    return formatter.format(dollars)
}

@Composable
private fun ComparisonRow(label: String, current: Long, previous: Long?) {
    Text(if (previous == null) "$label · données du mois précédent indisponibles" else if (previous == 0L) "$label · ${formatCadCents(current-previous)} de variation" else {
        val percent = (current.toDouble()-previous)/kotlin.math.abs(previous.toDouble())*100
        "$label · ${if(percent >= 0) "↑" else "↓"} ${String.format(Locale.CANADA, "%.1f", kotlin.math.abs(percent))}% · ${formatCadCents(current-previous)} de variation"
    }, style = MaterialTheme.typography.bodyMedium)
}
