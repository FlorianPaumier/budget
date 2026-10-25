package com.household.budget.ui

import androidx.compose.ui.res.stringResource
import com.household.budget.R
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

data class EntryRow(val id: String, val entryDate: String, val kind: EntryKind, val amountCents: Long,
    val categoryName: String?, val note: String?, val pending: Boolean, val canCorrect: Boolean = true)
data class PendingEntryRow(val operationId: String, val action: String, val state: String, val entryDate: String?,
    val amountCents: Long?, val note: String?, val errorCode: String?)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EntriesScreen(entries: List<EntryRow>, canEdit: Boolean, onAdd: () -> Unit, onEdit: (String) -> Unit,
    onDelete: (String) -> Unit, queued: List<PendingEntryRow> = emptyList(), onHistory: ((String) -> Unit)? = null) {
    var query by rememberSaveable { mutableStateOf("") }
    var kindFilter by rememberSaveable { mutableStateOf("all") }
    var categoryFilter by rememberSaveable { mutableStateOf<String?>(null) }
    var newest by rememberSaveable { mutableStateOf(true) }
    var categoryMenu by remember { mutableStateOf(false) }
    var selectedId by rememberSaveable { mutableStateOf<String?>(null) }
    var confirmingDelete by remember { mutableStateOf(false) }
    val selected = entries.firstOrNull { it.id == selectedId }
    val categories = remember(entries) { entries.mapNotNull { it.categoryName }.distinct().sorted() }
    val filtered = remember(entries, query, kindFilter, categoryFilter, newest) {
        entries.filter { entry ->
            (kindFilter == "all" || kindFilter == "expense" && entry.kind in setOf(EntryKind.EXPENSE, EntryKind.CATEGORY_ADJUSTMENT) || kindFilter == "income" && entry.kind == EntryKind.INCOME) &&
                (categoryFilter == null || entry.categoryName == categoryFilter) &&
                listOf(entry.note.orEmpty(), entry.categoryName.orEmpty(), entry.entryDate, entry.kind.label).any { it.contains(query, true) }
        }.let { if(newest) it.sortedByDescending { row -> row.entryDate } else it.sortedBy { row -> row.entryDate } }
    }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp, 8.dp, 20.dp, 100.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Text(stringResource(R.string.ui_transactions), style = MaterialTheme.typography.headlineMedium)
            Text(stringResource(R.string.ui_retrouvez_vos_depenses_et_vos_revenus), color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        item { OutlinedTextField(query, { query = it }, label = { Text(stringResource(R.string.ui_rechercher_une_transaction)) },
            placeholder = { Text(stringResource(R.string.ui_description_categorie_ou_date)) }, singleLine = true, modifier = Modifier.fillMaxWidth()) }
        item {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("all" to "Tout", "expense" to "Dépenses", "income" to "Revenus").forEach { (key, label) ->
                    FilterChip(selected = kindFilter == key, onClick = { kindFilter = key }, label = { Text(label) })
                }
            }
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.weight(1f)) {
                    TextButton(onClick = { categoryMenu = true }) { Text(categoryFilter ?: "Toutes les catégories") }
                    DropdownMenu(expanded = categoryMenu, onDismissRequest = { categoryMenu = false }) {
                        DropdownMenuItem(text = { Text(stringResource(R.string.ui_toutes_les_categories)) }, onClick = { categoryFilter = null; categoryMenu = false })
                        categories.forEach { category -> DropdownMenuItem(text = { Text(category) }, onClick = { categoryFilter = category; categoryMenu = false }) }
                    }
                }
                TextButton(onClick = { newest = !newest }) { Text(if(newest) "Plus récentes" else "Plus anciennes") }
            }
        }
        if(queued.isNotEmpty()) item { SectionHeader("À synchroniser") }
        items(queued, key = { "pending-${it.operationId}" }) { item ->
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(item.note?.takeIf { it.isNotBlank() } ?: "Modification enregistrée", style = MaterialTheme.typography.titleSmall)
                    item.amountCents?.let { Text(formatCadCents(it)) }
                    item.entryDate?.let { Text(friendlyEntryDate(it), style = MaterialTheme.typography.bodySmall) }
                    Text(if(item.state == "rejected") "À corriger · ${item.errorCode.orEmpty()}" else "En attente de synchronisation", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
        if(filtered.isEmpty()) item {
            EmptyState(if(entries.isEmpty()) "Aucune transaction ce mois-ci" else "Aucun résultat",
                if(entries.isEmpty()) "Votre première dépense vous aidera à suivre votre budget." else "Essayez une autre recherche ou réinitialisez les filtres.")
            if(entries.isEmpty() && canEdit) Button(onClick = onAdd) { Text(stringResource(R.string.ui_ajouter_une_transaction)) }
            if(entries.isNotEmpty()) TextButton(onClick = { query = ""; kindFilter = "all"; categoryFilter = null }) { Text(stringResource(R.string.ui_reinitialiser_les_filtres)) }
        }
        filtered.groupBy { it.entryDate }.forEach { (date, rows) ->
            item(key = "date-$date") { Text(friendlyEntryDate(date), style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 12.dp)) }
            items(rows, key = { it.id }) { entry ->
                Card(onClick = { selectedId = entry.id }, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                    Box(Modifier.padding(horizontal = 14.dp)) { TransactionItem(entry) }
                }
            }
        }
    }
    if(selected != null) {
        ModalBottomSheet(onDismissRequest = { selectedId = null; confirmingDelete = false }) {
            Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp).padding(bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text(selected.note?.takeIf { it.isNotBlank() } ?: selected.categoryName ?: selected.kind.label, style = MaterialTheme.typography.titleLarge)
                Text(formatCadCents(selected.amountCents), style = MaterialTheme.typography.headlineLarge)
                Text("${selected.kind.label} · ${friendlyEntryDate(selected.entryDate)}", color = MaterialTheme.colorScheme.onSurfaceVariant)
                selected.categoryName?.let { Text(it) }
                if(selected.pending) Text(stringResource(R.string.ui_cette_transaction_a_une_modification_en_attente_de_synchroni))
                if(canEdit && selected.canCorrect) Button(onClick = { selectedId = null; onEdit(selected.id) }, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.ui_modifier)) }
                onHistory?.let { callback -> OutlinedButton(onClick = { selectedId = null; callback(selected.id) }, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.ui_voir_lhistorique)) } }
                if(canEdit && selected.canCorrect) TextButton(onClick = { confirmingDelete = true }, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error)) { Text(stringResource(R.string.ui_supprimer)) }
            }
        }
        if(confirmingDelete) AlertDialog(onDismissRequest = { confirmingDelete = false },
            title = { Text(stringResource(R.string.ui_supprimer_cette_transaction)) }, text = { Text(stringResource(R.string.ui_elle_sera_retiree_du_budget_apres_synchronisation)) },
            dismissButton = { TextButton(onClick = { confirmingDelete = false }) { Text(stringResource(R.string.ui_conserver_la_transaction)) } },
            confirmButton = { TextButton(onClick = { if(canEdit && selected.canCorrect) { onDelete(selected.id); selectedId = null }; confirmingDelete = false }) { Text(stringResource(R.string.ui_supprimer_la_transaction)) } })
    }
}

fun friendlyEntryDate(iso: String): String = runCatching {
    LocalDate.parse(iso).format(DateTimeFormatter.ofPattern("d MMMM yyyy", Locale.CANADA_FRENCH))
}.getOrDefault(iso)
