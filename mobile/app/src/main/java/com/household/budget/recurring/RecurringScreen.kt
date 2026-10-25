package com.household.budget.recurring

import androidx.compose.ui.res.stringResource
import com.household.budget.R
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.household.budget.data.local.RecurringRuleEntity
import com.household.budget.data.local.OccurrenceEntity
import com.household.budget.data.local.PendingOperationEntity
import com.household.budget.ui.EntryCategory
import com.household.budget.ui.formatCadCents
import com.household.budget.ui.parseCadCents
import java.math.BigDecimal
import java.time.LocalDate

internal fun cadInput(cents: Long): String = BigDecimal.valueOf(cents, 2).toPlainString()

@Composable
fun RecurringScreen(
    rules: List<RecurringRuleEntity>, occurrences: List<OccurrenceEntity>, queued: List<PendingOperationEntity>,
    categories: List<EntryCategory>, today: String, canEdit: Boolean, isBusy: Boolean,
    onSaveRule: (RecurringDraft, String?, Long) -> Unit,
    onDeleteRule: (String, Long) -> Unit,
    onConfirm: (String, Long, String, Long) -> Unit,
    occurrenceEntryIds: Map<String, String> = emptyMap(), onViewEntry: (String) -> Unit = {},
) {
    var confirming by remember { mutableStateOf<OccurrenceEntity?>(null) }
    var editor by remember { mutableStateOf<RecurringRuleEntity?>(null) }
    var creating by remember { mutableStateOf(false) }
    var deleting by remember { mutableStateOf<RecurringRuleEntity?>(null) }
    if (creating || editor != null) {
        val rule = editor
        RecurringEditor(initial = rule?.let(::ruleDraft) ?: RecurringDraft("", amountCad = "", startsOn = today),
            categories = categories, isEditing = rule != null, isBusy = isBusy || !canEdit,
            onSave = { draft -> onSaveRule(draft, rule?.id, rule?.revision ?: 0); creating = false; editor = null },
            onCancel = { creating = false; editor = null })
        return
    }
    Column(Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(stringResource(R.string.ui_operations_regulieres), style = MaterialTheme.typography.headlineMedium)
        if (canEdit) Button(onClick = { creating = true }, enabled = !isBusy) { Text(stringResource(R.string.ui_ajouter_une_operation_reguliere)) }
        Text(stringResource(R.string.ui_vos_operations_regulieres), style = MaterialTheme.typography.titleMedium)
        if (occurrences.isEmpty()) Text(stringResource(R.string.ui_aucune_echeance_disponible_pour_ce_mois))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items(queued.filter { it.entityType in setOf("recurring_rule", "occurrence") }, key = { "pending-${it.operationId}" }) { operation ->
                Text("À synchroniser : ${operation.action} · ${operation.state}${operation.errorCode?.let { ": $it" }.orEmpty()}")
            }
            items(rules, key = { "rule-${it.id}" }) { rule ->
                val pending = queued.any { it.entityType == "recurring_rule" && it.entityId == rule.id }
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(12.dp)) {
                        Text(rule.name, style = MaterialTheme.typography.titleMedium)
                        Text("${recurringKindLabel(rule.kind)} · ${formatCadCents(rule.amountCents)}")
                        Text("${recurringFrequencyLabel(rule.frequency)} · intervalle ${rule.interval}")
                        Text("Début : ${rule.startsOn}${rule.endsOn?.let { "; fin : $it" }.orEmpty()}")
                        if (!rule.active) Text(stringResource(R.string.ui_desactivee))
                        if (pending) Text(stringResource(R.string.ui_a_synchroniser_les_echeances_seront_actualisees_apres_valida))
                        if (canEdit && !pending) Row {
                            TextButton(onClick = { editor = rule }, enabled = !isBusy) { Text(stringResource(R.string.ui_modifier)) }
                            TextButton(onClick = { deleting = rule }, enabled = !isBusy) { Text(stringResource(R.string.ui_supprimer)) }
                        }
                    }
                }
            }
            item { Text(stringResource(R.string.ui_echeances), style = MaterialTheme.typography.titleMedium) }
            items(occurrences, key = { it.id }) { occurrence ->
                val pending = queued.any { it.entityType == "occurrence" && it.entityId == occurrence.id }
                // Rule mutations regenerate expected rows on the server; confirmed history keeps its ID.
                val awaitingRuleSync = occurrence.status != "confirmed" && queued.any {
                    it.entityType == "recurring_rule" && it.entityId == occurrence.ruleId && it.state != "rejected"
                }
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(12.dp)) {
                        Text(occurrence.ruleName)
                        Text(occurrence.expectedDate)
                        Text(formatCadCents(occurrence.expectedAmountCents))
                        Text(when {
                            occurrence.status == "confirmed" && occurrence.confirmationMethod == "automatic" -> "Confirmée automatiquement"
                            occurrence.status == "confirmed" -> "Confirmée"
                            occurrence.expectedDate < today -> "En retard"
                            occurrence.expectedDate == today -> "À régler aujourd’hui"
                            else -> "Prévue"
                        })
                        occurrence.actualDate?.let { Text("Réel : $it · ${formatCadCents(occurrence.actualAmountCents ?: occurrence.expectedAmountCents)}") }
                        if (occurrence.needsReview) Text(stringResource(R.string.ui_a_verifier_cette_operation_a_ete_confirmee_automatiquement), color = MaterialTheme.colorScheme.error)
                        if (pending) Text(stringResource(R.string.ui_a_synchroniser))
                        if (awaitingRuleSync) Text(stringResource(R.string.ui_synchronisez_la_modification_avant_de_confirmer_cette_echean))
                        occurrenceEntryIds[occurrence.id]?.let { entryId ->
                            TextButton(onClick = { onViewEntry(entryId) }) { Text(stringResource(R.string.ui_voir_la_transaction)) }
                        }
                        if (canEdit && !pending && !awaitingRuleSync) TextButton(onClick = { confirming = occurrence }, enabled = !isBusy) {
                            Text(if (occurrence.status == "confirmed") "Corriger la confirmation" else "Confirmer")
                        }
                    }
                }
            }
        }
    }
    deleting?.let { rule ->
        AlertDialog(onDismissRequest = { deleting = null }, title = { Text("Supprimer ${rule.name} ?") },
            text = { Text(stringResource(R.string.ui_les_echeances_futures_seront_retirees_apres_synchronisation_)) },
            dismissButton = { TextButton(onClick = { deleting = null }) { Text(stringResource(R.string.ui_annuler)) } },
            confirmButton = { Button(enabled = canEdit && !isBusy, onClick = { onDeleteRule(rule.id, rule.revision); deleting = null }) { Text(stringResource(R.string.ui_confirmer_la_suppression)) } })
    }
    confirming?.let { occurrence ->
        var date by remember(occurrence.id) { mutableStateOf(occurrence.actualDate ?: occurrence.expectedDate) }
        var amount by remember(occurrence.id) { mutableStateOf(cadInput(occurrence.actualAmountCents ?: occurrence.expectedAmountCents)) }
        var error by remember { mutableStateOf<String?>(null) }
        AlertDialog(onDismissRequest = { confirming = null }, title = { Text("Confirmer ${occurrence.ruleName}") },
            text = { Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(date, { date = it }, label = { Text(stringResource(R.string.ui_date_reelle_aaaa_mm_jj)) }, singleLine = true)
                OutlinedTextField(amount, { amount = it }, label = { Text(stringResource(R.string.ui_montant_reel_ca)) }, singleLine = true)
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            } }, dismissButton = { TextButton(onClick = { confirming = null }) { Text(stringResource(R.string.ui_annuler)) } },
            confirmButton = { Button(enabled = canEdit && !isBusy, onClick = {
                val cents = parseCadCents(amount)
                if (!validRecurringDate(date) || cents == null || cents !in 1..9007199254740991L) {
                    error = "Saisissez une date valide et un montant positif."
                } else { onConfirm(occurrence.id, occurrence.revision, date, cents); confirming = null }
            }) { Text(stringResource(R.string.ui_enregistrer_la_confirmation)) } })
    }
}

private fun ruleDraft(rule: RecurringRuleEntity) = RecurringDraft(
    name = rule.name, kind = rule.kind, amountCad = cadInput(rule.amountCents), frequency = rule.frequency,
    interval = rule.interval, startsOn = rule.startsOn, endsOn = rule.endsOn, categoryId = rule.categoryId,
    days = rule.scheduleDetailsJson?.takeIf { it != "null" }?.let { raw ->
        val days = org.json.JSONObject(raw).optJSONArray("days")
        days?.let { (0 until it.length()).map(it::getInt) }
    }, active = rule.active,
)

@Composable
private fun RecurringEditor(initial: RecurringDraft, categories: List<EntryCategory>, isEditing: Boolean,
    isBusy: Boolean, onSave: (RecurringDraft) -> Unit, onCancel: () -> Unit) {
    var draft by remember(initial) { mutableStateOf(initial) }
    var interval by remember(initial) { mutableStateOf(initial.interval.toString()) }
    var firstDay by remember(initial) { mutableStateOf(initial.days?.getOrNull(0)?.toString() ?: "1") }
    var secondDay by remember(initial) { mutableStateOf(initial.days?.getOrNull(1)?.toString() ?: "15") }
    var errors by remember { mutableStateOf(emptyMap<String, String>()) }
    val parsed = draft.copy(interval = interval.toIntOrNull() ?: 0, days = if (draft.frequency == "twice_monthly")
        listOf(firstDay.toIntOrNull() ?: 0, secondDay.toIntOrNull() ?: 0) else null)
    Column(Modifier.fillMaxSize().imePadding().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(if (isEditing) "Modifier l’opération régulière" else "Nouvelle opération régulière", style = MaterialTheme.typography.headlineMedium)
        OutlinedTextField(draft.name, { draft = draft.copy(name = it) }, label = { Text(stringResource(R.string.ui_nom)) }, singleLine = true)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        listOf("income", "bill", "subscription").forEach { kind ->
            FilterChip(draft.kind == kind, { draft = draft.copy(kind = kind) }, label = { Text(recurringKindLabel(kind)) })
        }
        }
        OutlinedTextField(draft.amountCad, { draft = draft.copy(amountCad = it) }, label = { Text(stringResource(R.string.ui_montant_ca)) }, singleLine = true, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
        Text(stringResource(R.string.ui_frequence))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        listOf("daily" to "Chaque jour", "weekly" to "Chaque semaine", "biweekly" to "Toutes les deux semaines", "twice_monthly" to "Deux fois par mois", "monthly" to "Chaque mois", "yearly" to "Chaque année").forEach { (value, label) ->
            FilterChip(draft.frequency == value, { draft = draft.copy(frequency = value); interval = "1" }, label = { Text(label) })
        }
        }
        if (draft.frequency != "twice_monthly") OutlinedTextField(interval, { interval = it }, label = { Text(stringResource(R.string.ui_nombre_de_periodes_entre_deux_echeances_11000)) }, singleLine = true)
        else {
            OutlinedTextField(firstDay, { firstDay = it }, label = { Text(stringResource(R.string.ui_premier_jour_du_mois_131)) }, singleLine = true)
            OutlinedTextField(secondDay, { secondDay = it }, label = { Text(stringResource(R.string.ui_deuxieme_jour_du_mois_131)) }, singleLine = true)
        }
        OutlinedTextField(draft.startsOn, { draft = draft.copy(startsOn = it) }, label = { Text(stringResource(R.string.ui_date_de_debut_aaaa_mm_jj)) }, singleLine = true)
        OutlinedTextField(draft.endsOn.orEmpty(), { draft = draft.copy(endsOn = it.takeIf(String::isNotBlank)) }, label = { Text(stringResource(R.string.ui_date_de_fin_facultatif)) }, singleLine = true)
        Text(stringResource(R.string.ui_categorie_facultatif))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        FilterChip(draft.categoryId == null, { draft = draft.copy(categoryId = null) }, label = { Text(stringResource(R.string.ui_sans_categorie)) })
        categories.forEach { category -> FilterChip(draft.categoryId == category.id, { draft = draft.copy(categoryId = category.id) }, label = { Text(category.name) }) }
        }
        if (isEditing) Row { Checkbox(draft.active, { draft = draft.copy(active = it) }); Text(stringResource(R.string.ui_activee)) }
        Text(stringResource(R.string.ui_prochaines_echeances), style = MaterialTheme.typography.titleMedium)
        val preview = runCatching {
            val start = LocalDate.parse(parsed.startsOn)
            if (validateRecurringDraft(parsed).isEmpty()) previewRecurringDates(parsed, start, start.plusYears(1)).take(6) else emptyList()
        }.getOrDefault(emptyList())
        Text(if (preview.isEmpty()) "Complétez les champs pour voir les prochaines échéances." else preview.joinToString(" · ") { com.household.budget.ui.friendlyEntryDate(it.toString()) })
        Text(stringResource(R.string.ui_pour_un_mois_plus_court_la_derniere_journee_est_utilisee_le_))
        errors.values.forEach { Text(it, color = MaterialTheme.colorScheme.error) }
        Row {
            TextButton(onClick = onCancel) { Text(stringResource(R.string.ui_annuler)) }
            Button(enabled = !isBusy, onClick = { errors = validateRecurringDraft(parsed); if (errors.isEmpty()) onSave(parsed) }) { Text(stringResource(R.string.ui_enregistrer)) }
        }
    }
}

private fun recurringKindLabel(value: String): String = when(value) {
    "income" -> "Revenu"; "bill" -> "Facture"; "subscription" -> "Abonnement"; else -> value
}
private fun recurringFrequencyLabel(value: String): String = when(value) {
    "daily" -> "Chaque jour"; "weekly" -> "Chaque semaine"; "biweekly" -> "Toutes les deux semaines"
    "twice_monthly" -> "Deux fois par mois"; "monthly" -> "Chaque mois"; "yearly" -> "Chaque année"; else -> value
}
