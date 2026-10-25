package com.household.budget.ui

import androidx.compose.ui.res.stringResource
import com.household.budget.R
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.household.budget.application.CategoryAmount
import com.household.budget.application.DailyAmount
import kotlin.math.*

/** One small vector vocabulary, shared by navigation, cards and ledger rows. */
@Composable
fun BudgetIcon(name: String, description: String? = null, modifier: Modifier = Modifier, color: Color = LocalContentColor.current) {
    Canvas(modifier.size(24.dp).then(if (description != null) Modifier.semantics { contentDescription = description } else Modifier)) {
        val w = size.width / 24f
        fun line(x: Float, y: Float, xx: Float, yy: Float) = drawLine(color, Offset(x*w,y*w), Offset(xx*w,yy*w), 1.8f*w, StrokeCap.Round)
        when (name) {
            "left" -> { line(14f,6f,8f,12f); line(8f,12f,14f,18f) }
            "right" -> { line(10f,6f,16f,12f); line(16f,12f,10f,18f) }
            "add" -> { line(5f,12f,19f,12f); line(12f,5f,12f,19f) }
            "home" -> { line(3f,11f,12f,3f); line(12f,3f,21f,11f); line(5f,10f,5f,21f); line(5f,21f,19f,21f); line(19f,21f,19f,10f); line(10f,21f,10f,15f); line(10f,15f,14f,15f); line(14f,15f,14f,21f) }
            "list" -> { for (y in listOf(6f,12f,18f)) { line(8f,y,21f,y); drawCircle(color, w, Offset(3*w,y*w)) } }
            "chart" -> { line(4f,20f,4f,5f); line(4f,20f,21f,20f); line(7f,15f,11f,10f); line(11f,10f,15f,13f); line(15f,13f,21f,5f) }
            "person" -> { drawCircle(color, 4*w, Offset(12*w,7*w), style=Stroke(1.8f*w)); drawArc(color,180f,180f,false,Offset(4*w,14*w),Size(16*w,12*w),style=Stroke(1.8f*w)) }
            "income", "expense" -> { line(6f,18f,18f,6f); if (name == "income") { line(6f,18f,6f,10f); line(6f,18f,14f,18f) } else { line(18f,6f,10f,6f); line(18f,6f,18f,14f) } }
            "savings" -> { drawCircle(color,8*w,Offset(12*w,12*w),style=Stroke(1.8f*w)); line(12f,7f,12f,17f); line(9f,9f,15f,9f); line(9f,15f,15f,15f) }
            else -> { line(4f,6f,20f,6f); line(4f,6f,4f,19f); line(4f,19f,20f,19f); line(20f,19f,20f,6f); line(15f,11f,21f,11f); line(21f,11f,21f,15f); line(21f,15f,15f,15f) }
        }
    }
}

@Composable
fun BalanceCard(cents: Long?, title: String) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primary, contentColor = MaterialTheme.colorScheme.onPrimary), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(title, style = MaterialTheme.typography.titleMedium)
                BudgetIcon("wallet")
            }
            Text(formatCadCents(cents), style = MaterialTheme.typography.headlineLarge)
            Text(stringResource(R.string.ui_solde_du_compte_disponible_ca), style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
fun FinancialSummaryCard(title: String, cents: Long?, icon: String, modifier: Modifier = Modifier) {
    Card(modifier, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            BudgetIcon(icon, color = if (icon == "expense") MaterialTheme.colorScheme.secondary else MaterialTheme.colorScheme.primary)
            Text(title, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(formatCadCents(cents), style = MaterialTheme.typography.titleLarge)
        }
    }
}

@Composable
fun SectionHeader(title: String, action: String? = null, onAction: () -> Unit = {}) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(title, Modifier.weight(1f), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        if (action != null) TextButton(onClick = onAction) { Text(action) }
    }
}

@Composable
fun EmptyState(title: String, explanation: String) {
    Column(Modifier.fillMaxWidth().padding(vertical = 20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, style = MaterialTheme.typography.titleMedium)
        Text(explanation, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
fun TransactionItem(entry: EntryRow) {
    val income = entry.kind == EntryKind.INCOME
    val expense = entry.kind in setOf(EntryKind.EXPENSE, EntryKind.CATEGORY_ADJUSTMENT)
    val signedAmount = (if(income) "+" else if(expense) "−" else "") + formatCadCents(entry.amountCents)
    val color = if(income) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface
    BoxWithConstraints(Modifier.fillMaxWidth().semantics(mergeDescendants = true) {}.padding(vertical = 12.dp)) {
        val stacked = maxWidth < 280.dp || androidx.compose.ui.platform.LocalDensity.current.fontScale > 1.3f
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(Modifier.size(40.dp).background(MaterialTheme.colorScheme.surfaceVariant, CircleShape), contentAlignment = Alignment.Center) {
                    BudgetIcon(if(income) "income" else if(expense) "expense" else "wallet", color = MaterialTheme.colorScheme.primary)
                }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(entry.note?.takeIf { it.isNotBlank() } ?: entry.categoryName ?: entry.kind.label, style = MaterialTheme.typography.titleSmall)
                    Text("${entry.kind.label} · ${entry.categoryName ?: friendlyEntryDate(entry.entryDate)}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    if(entry.pending) Text(stringResource(R.string.ui_a_synchroniser), style = MaterialTheme.typography.labelSmall)
                }
                if(!stacked) Text(signedAmount, fontWeight = FontWeight.SemiBold, color = color)
            }
            if(stacked) Text(signedAmount, modifier = Modifier.padding(start = 52.dp), fontWeight = FontWeight.SemiBold, color = color)
        }
    }
}

@Composable
fun FinancialLineChart(points: List<DailyAmount>) {
    var selected by remember(points) { mutableIntStateOf(-1) }
    val ink = MaterialTheme.colorScheme.primary
    val rule = MaterialTheme.colorScheme.outlineVariant
    val peak = points.maxOfOrNull { it.cents }?.coerceAtLeast(1) ?: 1L
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            SectionHeader("Dépenses par jour")
            if (points.isEmpty() || points.all { it.cents == 0L }) EmptyState("Aucune dépense enregistrée", "Vos dépenses quotidiennes apparaîtront ici.")
            else {
                Text(if (selected in points.indices) "${friendlyEntryDate(points[selected].date.toString())} · ${formatCadCents(points[selected].cents)}" else "Touchez la courbe pour consulter un jour", style = MaterialTheme.typography.bodySmall, color = ink)
                Canvas(Modifier.fillMaxWidth().height(140.dp).semantics {
                    contentDescription = "Dépenses par jour. Maximum : ${formatCadCents(peak)}. Utilisez les boutons de jour pour consulter les montants exacts."
                }.pointerInput(points) {
                    detectTapGestures { point -> selected = ((point.x / size.width) * points.lastIndex).roundToInt().coerceIn(points.indices) }
                }) {
                    val top = 10.dp.toPx(); val height = size.height - 2*top
                    for (fraction in listOf(0f, .5f, 1f)) drawLine(rule, Offset(0f,top+height*fraction), Offset(size.width,top+height*fraction), 1.dp.toPx())
                    fun offset(i: Int) = Offset(i.toFloat()/points.lastIndex.coerceAtLeast(1)*size.width, top + height*(1f-points[i].cents.toFloat()/peak))
                    val path = Path().apply { points.indices.forEach { i -> val p=offset(i); if(i==0) moveTo(p.x,p.y) else lineTo(p.x,p.y) } }
                    val fill = Path().apply { addPath(path); lineTo(size.width,size.height); lineTo(0f,size.height); close() }
                    drawPath(fill, ink.copy(alpha=.08f)); drawPath(path,ink,style=Stroke(2.5.dp.toPx(),cap=StrokeCap.Round))
                    if(selected in points.indices) { val p=offset(selected); drawLine(ink.copy(alpha=.3f),Offset(p.x,0f),Offset(p.x,size.height),1.dp.toPx()); drawCircle(ink,5.dp.toPx(),p) }
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text(points.first().date.toString(), style = MaterialTheme.typography.labelSmall); Text(points.last().date.toString(), style = MaterialTheme.typography.labelSmall) }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    TextButton(onClick = { selected = (if(selected < 0) 0 else selected-1).coerceAtLeast(0) }) { Text(stringResource(R.string.ui_jour_precedent)) }
                    TextButton(onClick = { selected = (selected+1).coerceAtMost(points.lastIndex) }) { Text(stringResource(R.string.ui_jour_suivant)) }
                }
            }
        }
    }
}

@Composable
fun CategoryDonutChart(categories: List<CategoryAmount>) {
    val slices = remember(categories) { if(categories.size <= 6) categories else categories.take(5) + CategoryAmount("Autres",categories.drop(5).sumOf { it.cents }) }
    val total = slices.sumOf { it.cents }
    var selected by remember(categories) { mutableIntStateOf(-1) }
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            SectionHeader("Répartition des dépenses")
            if(total <= 0) EmptyState("Aucune dépense à répartir", "Ajoutez une dépense pour voir sa catégorie ici.")
            else {
                Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    Canvas(Modifier.size(190.dp).semantics { contentDescription = "Répartition des dépenses. Sélectionnez une catégorie pour son montant et sa proportion." }.pointerInput(slices) {
                        detectTapGestures { p ->
                            val dx=p.x-size.width/2; val dy=p.y-size.height/2
                            val radius=sqrt(dx*dx+dy*dy)
                            if(radius < size.width*.28f || radius > size.width*.5f) return@detectTapGestures
                            val angle = ((atan2(dy,dx)*180/PI+450)%360).toFloat()
                            var end=0f
                            selected=slices.indexOfFirst { end += it.cents.toFloat()/total*360; angle < end }
                        }
                    }) {
                        var start=-90f; val inset=20.dp.toPx()
                        slices.forEachIndexed { i, c ->
                            val angle=c.cents.toFloat()/total*360
                            drawArc(BudgetTokens.CategoryColors[i],start+1, (angle-2).coerceAtLeast(.1f),false,
                                Offset(inset,inset),Size(size.width-2*inset,size.height-2*inset),style=Stroke(if(i==selected) 26.dp.toPx() else 20.dp.toPx(), cap=StrokeCap.Butt))
                            start+=angle
                        }
                    }
                    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.widthIn(max = 130.dp)) {
                        Text(formatCadCents(if(selected in slices.indices) slices[selected].cents else total), style = MaterialTheme.typography.titleMedium)
                        Text(if(selected in slices.indices) slices[selected].name else "Total dépensé", style = MaterialTheme.typography.labelSmall)
                    }
                }
                slices.forEachIndexed { i, category ->
                    val percent=(category.cents.toDouble()/total*100).roundToInt()
                    TextButton(onClick = { selected = if(selected==i) -1 else i }, modifier = Modifier.fillMaxWidth()) {
                        Box(Modifier.size(10.dp).background(BudgetTokens.CategoryColors[i],CircleShape))
                        Spacer(Modifier.width(12.dp))
                        Text(category.name,Modifier.weight(1f), color = MaterialTheme.colorScheme.onSurface)
                        Text("${formatCadCents(category.cents)} · $percent%",fontWeight = if(selected==i) FontWeight.Bold else FontWeight.Normal)
                    }
                }
            }
        }
    }
}

@Composable
fun BudgetProgressCard(name: String, budget: Long, used: Long) {
    val ratio = if(budget > 0) used.toFloat()/budget else if(used > 0) 1f else 0f
    val progress by animateFloatAsState(ratio.coerceIn(0f,1f),tween(BudgetTokens.Motion), label = "budget progress")
    val over = used > budget
    val status = if(over) "Budget dépassé" else if(ratio >= .85f) "Proche de la limite" else "Dans le budget"
    val color = if(over) MaterialTheme.colorScheme.error else if(ratio >= .85f) MaterialTheme.colorScheme.secondary else MaterialTheme.colorScheme.primary
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(name, style = MaterialTheme.typography.titleMedium)
        Text("${formatCadCents(used)} / ${formatCadCents(budget)}", style = MaterialTheme.typography.bodyLarge)
        LinearProgressIndicator(progress = { progress }, modifier = Modifier.fillMaxWidth().height(6.dp), color = color)
        Text("$status · ${(ratio*100).roundToInt()} % utilisé", color = color, style = MaterialTheme.typography.labelMedium)
        Text(if(over) "${formatCadCents(used-budget)} de dépassement" else "${formatCadCents(budget-used)} disponibles", style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
fun FinancialOverview(state: MonthDashboardState, insights: com.household.budget.application.FinancialInsights) {
    var explanation by remember { mutableStateOf(false) }
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            BoxWithConstraints {
                if(maxWidth < 320.dp || androidx.compose.ui.platform.LocalDensity.current.fontScale > 1.3f) {
                    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        OverviewMetric("Revenus", state.incomeCents ?: state.actualMoneyLeftTodayCents?.let { insights.incomeCents }, "income")
                        OverviewMetric("Dépenses", state.spendingCents ?: state.actualMoneyLeftTodayCents?.let { insights.expenseCents }, "expense")
                    }
                } else Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    OverviewMetric("Revenus", state.incomeCents ?: state.actualMoneyLeftTodayCents?.let { insights.incomeCents }, "income", Modifier.weight(1f))
                    OverviewMetric("Dépenses", state.spendingCents ?: state.actualMoneyLeftTodayCents?.let { insights.expenseCents }, "expense", Modifier.weight(1f))
                }
            }
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OverviewBalance("Reste prévu en fin de mois", state.plannedMoneyLeftCents)
                OverviewBalance("Compte d’épargne", state.savingsCents)
            }
            TextButton(onClick = { explanation = true }, contentPadding = PaddingValues(horizontal = 0.dp)) { Text(stringResource(R.string.ui_comprendre_ces_montants)) }
        }
    }
    if(explanation) AlertDialog(onDismissRequest = { explanation = false }, title = { Text(stringResource(R.string.ui_votre_argent_simplement)) },
        text = { Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(stringResource(R.string.ui_disponible_le_solde_apres_les_operations_confirmees_il_peut_))
            Text(stringResource(R.string.ui_reste_prevu_revenus_attendus_moins_les_factures_les_budgets_))
            Text(stringResource(R.string.ui_epargne_le_solde_du_compte_depargne_un_transfert_entre_vos_c))
        } }, confirmButton = { TextButton(onClick = { explanation = false }) { Text(stringResource(R.string.ui_compris)) } })
}

@Composable
private fun OverviewMetric(title: String, amount: Long?, icon: String, modifier: Modifier = Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            BudgetIcon(icon, color = if(icon == "expense") MaterialTheme.colorScheme.secondary else MaterialTheme.colorScheme.primary)
            Text(title, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
        }
        Text(formatCadCents(amount), style = MaterialTheme.typography.titleLarge)
    }
}

@Composable
private fun OverviewBalance(title: String, amount: Long?) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(title, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(formatCadCents(amount), style = MaterialTheme.typography.titleSmall)
    }
}

@Composable
fun ProfileAction(title: String, description: String, icon: String, onClick: () -> Unit) {
    Card(onClick = onClick, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Row(Modifier.fillMaxWidth().padding(20.dp), horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.CenterVertically) {
            BudgetIcon(icon, color = MaterialTheme.colorScheme.primary)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(title, style = MaterialTheme.typography.titleMedium)
                Text(description, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            BudgetIcon("right")
        }
    }
}
