package com.household.budget.ui

import androidx.compose.ui.res.stringResource
import com.household.budget.R
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp

data class EstimateRow(val categoryId: String, val categoryName: String, val amountCents: Long, val suggestedCents: Long?, val sampleCount: Int)

@Composable
fun PlanScreen(estimates: List<EstimateRow>, savingsTargetCents: Long?, onEditEstimate: (String, Long) -> Unit,
    onAcceptSuggestion: (String) -> Unit, onEditSavingsTarget: (Long?) -> Unit, canEdit: Boolean = true, spending: Map<String, Long> = emptyMap()) {
    var editingTarget by rememberSaveable { mutableStateOf(false) }
    var targetAmount by rememberSaveable(savingsTargetCents) { mutableStateOf(savingsTargetCents?.let(::centsForInput) ?: "") }
    var targetError by remember { mutableStateOf(false) }
    LazyColumn(Modifier.fillMaxSize().imePadding(), contentPadding = PaddingValues(20.dp, 8.dp, 20.dp, 100.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item {
            Text(stringResource(R.string.ui_budget_du_mois), style = MaterialTheme.typography.headlineMedium)
            Text(stringResource(R.string.ui_ce_que_vous_avez_prevu_ce_quil_vous_reste), color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        item {
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
                Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(stringResource(R.string.ui_objectif_depargne), style = MaterialTheme.typography.titleMedium)
                    Text(savingsTargetCents?.let(::formatCadCents) ?: "Aucun objectif pour ce mois", style = MaterialTheme.typography.titleLarge)
                    if(canEdit && editingTarget) {
                        OutlinedTextField(targetAmount, { targetAmount = it; targetError = false }, label = { Text(stringResource(R.string.ui_objectif_depargne_ca)) }, singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), isError = targetError,
                            supportingText = { if(targetError) Text(stringResource(R.string.ui_saisissez_un_montant_positif_ou_zero)) }, modifier = Modifier.fillMaxWidth())
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(onClick = {
                                val cents = parseCadCents(targetAmount)
                                if(cents != null && cents >= 0) { onEditSavingsTarget(cents); editingTarget = false } else targetError = true
                            }) { Text(stringResource(R.string.ui_enregistrer_lobjectif)) }
                            TextButton(onClick = { onEditSavingsTarget(null); editingTarget = false }) { Text(stringResource(R.string.ui_retirer_lobjectif)) }
                            TextButton(onClick = { editingTarget = false; targetError = false; targetAmount = savingsTargetCents?.let(::centsForInput) ?: "" }) { Text(stringResource(R.string.ui_annuler)) }
                        }
                    } else if(canEdit) TextButton(onClick = { editingTarget = true }) { Text(stringResource(R.string.ui_modifier_lobjectif_depargne)) }
                }
            }
        }
        item { SectionHeader("Par catégorie") }
        if(estimates.isEmpty()) item { EmptyState("Aucun budget par catégorie", "Créez des catégories dans Profil → Foyer, puis fixez vos montants mensuels ici.") }
        items(estimates, key = { it.categoryId }) { estimate ->
            var editing by rememberSaveable(estimate.categoryId) { mutableStateOf(false) }
            var amount by rememberSaveable(estimate.categoryId, estimate.amountCents) { mutableStateOf(centsForInput(estimate.amountCents)) }
            var error by remember { mutableStateOf(false) }
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    BudgetProgressCard(estimate.categoryName, estimate.amountCents, spending[estimate.categoryName] ?: 0L)
                    if(canEdit && editing) {
                        OutlinedTextField(amount, { amount = it; error = false }, label = { Text(stringResource(R.string.ui_budget_prevu_ca)) }, singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), isError = error,
                            supportingText = { if(error) Text(stringResource(R.string.ui_saisissez_un_montant_positif_ou_zero)) }, modifier = Modifier.fillMaxWidth())
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(onClick = {
                                val cents = parseCadCents(amount)
                                if(cents != null && cents >= 0) { onEditEstimate(estimate.categoryId,cents); editing = false } else error = true
                            }) { Text(stringResource(R.string.ui_enregistrer_le_budget)) }
                            TextButton(onClick = { editing = false; error = false; amount = centsForInput(estimate.amountCents) }) { Text(stringResource(R.string.ui_annuler)) }
                        }
                    } else if(canEdit) TextButton(onClick = { editing = true }) { Text(stringResource(R.string.ui_modifier_le_budget)) }
                    if(estimate.suggestedCents != null && estimate.sampleCount > 0) {
                        Text("Suggestion : ${formatCadCents(estimate.suggestedCents)} · ${estimate.sampleCount} mois", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        if(canEdit) TextButton(onClick = { onAcceptSuggestion(estimate.categoryId) }) { Text(stringResource(R.string.ui_utiliser_la_suggestion)) }
                    }
                }
            }
        }
    }
}

private fun centsForInput(cents: Long): String = java.math.BigDecimal.valueOf(cents, 2).setScale(2).toPlainString().replace('.', ',')
