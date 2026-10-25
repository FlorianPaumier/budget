package com.household.budget.ui

import androidx.compose.ui.res.stringResource
import com.household.budget.R
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale

data class EntryCategory(val id: String, val name: String)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EntryEditor(
    initial: EntryDraft,
    categories: List<EntryCategory>,
    onSave: (EntryDraft) -> Unit,
    onCancel: () -> Unit,
    isEditing: Boolean = false,
    isBusy: Boolean = false,
    asBottomSheet: Boolean = false,
    error: String? = null,
) {
    var kindName by rememberSaveable(initial) { mutableStateOf(initial.kind.name) }
    var amount by rememberSaveable(initial) { mutableStateOf(initial.amountCad.replace('.', ',')) }
    var categoryId by rememberSaveable(initial) { mutableStateOf(initial.categoryId) }
    var accountName by rememberSaveable(initial) { mutableStateOf(initial.account?.name) }
    var date by rememberSaveable(initial) { mutableStateOf(initial.entryDate) }
    var note by rememberSaveable(initial) { mutableStateOf(initial.note) }
    val kind = EntryKind.valueOf(kindName)
    val draft = EntryDraft(kind, date, amount, categoryId, accountName?.let(EntryAccount::valueOf), note)
    var advanced by rememberSaveable { mutableStateOf(kind in setOf(EntryKind.CATEGORY_ADJUSTMENT, EntryKind.BALANCE_ADJUSTMENT)) }
    var validation by remember { mutableStateOf(EntryValidation(emptyMap())) }
    var choosingDate by rememberSaveable { mutableStateOf(false) }
    var discarding by rememberSaveable { mutableStateOf(false) }
    val changed = draft.copy(amountCad = draft.amountCad.replace(',', '.')) != initial.copy(amountCad = initial.amountCad.replace(',', '.'))
    fun close() { if (!isBusy) { if(changed) discarding = true else onCancel() } }
    val requestClose by rememberUpdatedState(newValue = { close() })
    val editorContent: @Composable () -> Unit = {
        BackHandler { close() }

        Scaffold(containerColor = MaterialTheme.colorScheme.background,
            contentWindowInsets = if (asBottomSheet) WindowInsets(0, 0, 0, 0) else ScaffoldDefaults.contentWindowInsets,
            bottomBar = {
                Surface(color = MaterialTheme.colorScheme.surface, tonalElevation = 1.dp) {
                    Column(Modifier.fillMaxWidth().imePadding().padding(horizontal = 20.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Button(onClick = {
                            validation = validateEntryDraft(draft)
                            if(validation.isValid) onSave(draft)
                        }, enabled = !isBusy, modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp)) {
                            Text(if (isBusy) "Enregistrement…" else "Enregistrer")
                        }
                        Text(stringResource(R.string.ui_enregistre_sur_ce_telephone_puis_synchronise_avec_le_foyer), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }) { padding ->
            Column(Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(if(isEditing) "Modifier" else "Ajouter", style = MaterialTheme.typography.headlineMedium)
                    TextButton(onClick = { close() }, enabled = !isBusy) { Text(stringResource(R.string.ui_annuler)) }
                }
                Text(stringResource(R.string.ui_un_montant_une_categorie_cest_tout), color = MaterialTheme.colorScheme.onSurfaceVariant)
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(EntryKind.EXPENSE, EntryKind.INCOME, EntryKind.SAVINGS_TRANSFER).forEach { option ->
                        FilterChip(selected = kind == option, enabled = !isEditing && !isBusy, onClick = {
                            kindName = option.name; categoryId = null; accountName = null; validation = EntryValidation(emptyMap())
                        }, label = { Text(option.label) })
                    }
                }
                OutlinedTextField(value = amount, onValueChange = { amount = it },
                    label = { Text(stringResource(R.string.ui_montant_ca)) }, placeholder = { Text(stringResource(R.string.ui_0_00)) }, singleLine = true,
                    enabled = !isBusy, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    textStyle = MaterialTheme.typography.headlineLarge,
                    isError = validation.errors.containsKey("amountCad"),
                    supportingText = { validation.errors["amountCad"]?.let { Text(it) } }, modifier = Modifier.fillMaxWidth())
                if(kind == EntryKind.EXPENSE || kind == EntryKind.CATEGORY_ADJUSTMENT) {
                    Text(stringResource(R.string.ui_categorie), style = MaterialTheme.typography.titleMedium)
                    if(categories.isEmpty()) EmptyState("Aucune catégorie", "Ajoutez une catégorie dans Profil → Foyer pour enregistrer une dépense.")
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        categories.forEach { category -> FilterChip(selected = categoryId == category.id,
                            onClick = { categoryId = category.id }, enabled = !isBusy, label = { Text(category.name) }) }
                    }
                    validation.errors["categoryId"]?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                }
                OutlinedButton(onClick = { choosingDate = true }, enabled = !isBusy, modifier = Modifier.fillMaxWidth()) {
                    Text(stringResource(R.string.ui_date) + runCatching { LocalDate.parse(date).format(DateTimeFormatter.ofPattern("d MMMM yyyy", Locale.CANADA_FRENCH)) }.getOrDefault(date))
                }
                validation.errors["entryDate"]?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                OutlinedTextField(note, { note = it }, label = { Text(stringResource(R.string.ui_description_facultatif)) },
                    placeholder = { Text(stringResource(R.string.ui_ex_epicerie_de_la_semaine)) }, enabled = !isBusy,
                    isError = validation.errors.containsKey("note"), supportingText = { validation.errors["note"]?.let { Text(it) } }, modifier = Modifier.fillMaxWidth())
                TextButton(onClick = { advanced = !advanced }, enabled = !isBusy) { Text(if(advanced) "Masquer les ajustements" else "Ajustements avancés") }
                if(advanced) {
                    Text(stringResource(R.string.ui_pour_corriger_un_solde_ou_une_categorie), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf(EntryKind.CATEGORY_ADJUSTMENT, EntryKind.BALANCE_ADJUSTMENT).forEach { option ->
                            FilterChip(selected = kind == option, enabled = !isEditing && !isBusy, onClick = {
                                kindName = option.name; categoryId = null; accountName = null
                            }, label = { Text(option.label) })
                        }
                    }
                }
                if(kind == EntryKind.BALANCE_ADJUSTMENT) {
                    Text(stringResource(R.string.ui_compte), style = MaterialTheme.typography.titleMedium)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        EntryAccount.entries.forEach { account -> FilterChip(selected = accountName == account.name,
                            onClick = { accountName = account.name }, enabled = !isBusy, label = { Text(account.label) }) }
                    }
                    validation.errors["account"]?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                }
            }
        }
        if(choosingDate) {
            // Material date selections are UTC calendar dates; never convert through the phone zone.
            val picker = rememberDatePickerState(initialSelectedDateMillis = runCatching { LocalDate.parse(date).atStartOfDay().toInstant(ZoneOffset.UTC).toEpochMilli() }.getOrNull())
            DatePickerDialog(onDismissRequest = { choosingDate = false },
                confirmButton = { TextButton(enabled = picker.selectedDateMillis != null, onClick = {
                    picker.selectedDateMillis?.let { date = Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate().toString() }
                    choosingDate = false
                }) { Text(stringResource(R.string.ui_choisir_cette_date)) } },
                dismissButton = { TextButton(onClick = { choosingDate = false }) { Text(stringResource(R.string.ui_annuler)) } }) {
                DatePicker(state = picker)
            }
        }
        if(discarding) AlertDialog(onDismissRequest = { discarding = false },
            title = { Text(stringResource(R.string.ui_quitter_sans_enregistrer)) }, text = { Text(stringResource(R.string.ui_votre_saisie_sera_perdue)) },
            dismissButton = { TextButton(onClick = { discarding = false }) { Text(stringResource(R.string.ui_continuer_la_saisie)) } },
            confirmButton = { TextButton(onClick = onCancel) { Text(stringResource(R.string.ui_quitter)) } })
    }
    if (asBottomSheet) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true,
            confirmValueChange = { value ->
                if (value == SheetValue.Hidden) {
                    // Keep the sheet visible until the draft owner permits dismissal.
                    requestClose()
                    false
                } else true
            })
        ModalBottomSheet(onDismissRequest = { requestClose() }, sheetState = sheetState,
            containerColor = MaterialTheme.colorScheme.background,
            modifier = Modifier.testTag("entry-editor-drawer")) {
            Box(Modifier.fillMaxWidth().fillMaxHeight(0.92f)) { editorContent() }
        }
    } else editorContent()

}


@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EntryEditorLoadingDrawer(onCancel: () -> Unit) {
    ModalBottomSheet(onDismissRequest = onCancel) {
        Column(Modifier.fillMaxWidth().padding(20.dp)) {
            EmptyState("Chargement de la transaction", "La transaction est récupérée depuis ce téléphone.")
            TextButton(onClick = onCancel) { Text(stringResource(R.string.ui_annuler)) }
        }
    }
}
