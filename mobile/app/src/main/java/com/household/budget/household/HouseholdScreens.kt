package com.household.budget.household

import androidx.compose.ui.res.stringResource
import com.household.budget.R
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.Image
import androidx.compose.ui.graphics.asImageBitmap
import android.graphics.Bitmap
import android.graphics.Color
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.household.budget.data.remote.PairingCode
import com.household.budget.ui.EntryKind
import com.household.budget.ui.formatCadCents
import org.json.JSONObject

data class CategoryRow(val id: String, val name: String, val active: Boolean, val revision: Long, val pending: Boolean = false)
@Composable fun HouseholdManagementScreen(categories: List<CategoryRow>, devices: List<PhoneRow>, canEdit: Boolean, pairing: PairingCode?, onCreateCategory: (String) -> Unit, onUpdateCategory: (String, String, Boolean) -> Unit, onDeleteCategory: (String) -> Unit, onRenameDevice: (String, String) -> Unit, onRevokeDevice: (String) -> Unit, onCreatePairing: () -> Unit, onInvalidatePairing: () -> Unit) {
    var newName by remember { mutableStateOf("") }
    var rename by remember { mutableStateOf<PhoneRow?>(null) }
    var revoke by remember { mutableStateOf<PhoneRow?>(null) }
    var editCategory by remember { mutableStateOf<CategoryRow?>(null) }
    var deleteCategory by remember { mutableStateOf<CategoryRow?>(null) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(stringResource(R.string.ui_foyer), style = MaterialTheme.typography.headlineMedium)
        Text(stringResource(R.string.ui_categories), style = MaterialTheme.typography.titleLarge)
        if (canEdit) {
            OutlinedTextField(newName, { newName = it }, label = { Text(stringResource(R.string.ui_nom_de_la_categorie)) }, singleLine = true)
            Button(onClick = { onCreateCategory(newName.trim()); newName = "" }, enabled = newName.trim().length in 1..120) { Text(stringResource(R.string.ui_ajouter_une_categorie)) }
        }
        categories.forEach { category ->
            Text("${category.name}${if (!category.active) " (archivée)" else ""}")
            if (category.pending) Text(stringResource(R.string.ui_categorie_modifiee_en_attente_de_synchronisation))
            if (canEdit) {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TextButton({ editCategory = category }) { Text("Renommer ${category.name}") }
                    TextButton({ onUpdateCategory(category.id, category.name, !category.active) }) { Text(if (category.active) "Archiver ${category.name}" else "Réactiver ${category.name}") }
                    TextButton({ deleteCategory = category }) { Text("Supprimer ${category.name}") }
                }
            }
        }
        HorizontalDivider()
        Text(stringResource(R.string.ui_telephones_connectes), style = MaterialTheme.typography.titleLarge)
        devices.forEach { device ->
            Text(device.label)
            Text("Connecté le ${device.pairedAt}")
            if (device.revokedAt != null) Text("Déconnecté le ${device.revokedAt}")
            else if (canEdit) {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TextButton({ rename = device }) { Text("Renommer ${device.label}") }
                    TextButton({ revoke = device }) { Text("Déconnecter ${device.label}") }
                }
            }
        }
        if (canEdit) {
            Button(onCreatePairing) { Text(stringResource(R.string.ui_connecter_un_autre_telephone)) }
            TextButton(onInvalidatePairing) { Text(stringResource(R.string.ui_annuler_les_codes_non_utilises)) }
        }
        pairing?.let {
            Text("Ce code expire dans ${it.expiresInSeconds} secondes et ne peut être utilisé qu’une fois.")
            val bitmap = remember(it.uri) {
                val matrix = pairingQrMatrix(it.uri)
                Bitmap.createBitmap(matrix.width, matrix.height, Bitmap.Config.ARGB_8888).apply {
                    setPixels(IntArray(matrix.width * matrix.height) { index ->
                        if (matrix[index % matrix.width, index / matrix.width]) Color.BLACK else Color.WHITE
                    }, 0, matrix.width, 0, 0, matrix.width, matrix.height)
                }
            }
            Image(bitmap.asImageBitmap(), contentDescription = "QR de connexion pour un autre téléphone du foyer", modifier = Modifier.widthIn(max = 256.dp).fillMaxWidth().aspectRatio(1f))
            Text(stringResource(R.string.ui_scannez_ce_qr_sur_lecran_de_connexion_de_lautre_telephone))
        }
        Text(stringResource(R.string.ui_la_gestion_des_telephones_necessite_une_connexion_au_serveur))
    }
    rename?.let { phone -> NameDialog("Renommer le téléphone", phone.label, { rename = null }) { onRenameDevice(phone.id, it); rename = null } }
    editCategory?.let { category -> NameDialog("Renommer la catégorie", category.name, { editCategory = null }) { onUpdateCategory(category.id, it, category.active); editCategory = null } }
    revoke?.let { phone -> AlertDialog(onDismissRequest = { revoke = null }, title = { Text("Déconnecter ${phone.label} ?") }, text = { Text(stringResource(R.string.ui_ce_telephone_devra_se_reconnecter_ses_modifications_locales_)) }, confirmButton = { TextButton({ onRevokeDevice(phone.id); revoke = null }) { Text(stringResource(R.string.ui_deconnecter_ce_telephone)) } }, dismissButton = { TextButton({ revoke = null }) { Text(stringResource(R.string.ui_annuler)) } }) }
    deleteCategory?.let { category -> AlertDialog(onDismissRequest = { deleteCategory = null }, title = { Text("Supprimer ${category.name} ?") }, text = { Text(stringResource(R.string.ui_les_transactions_precedentes_restent_dans_lhistorique)) }, confirmButton = { TextButton({ onDeleteCategory(category.id); deleteCategory = null }) { Text(stringResource(R.string.ui_confirmer_la_suppression)) } }, dismissButton = { TextButton({ deleteCategory = null }) { Text(stringResource(R.string.ui_annuler)) } }) }
}
@Composable private fun NameDialog(title: String, initial: String, onDismiss: () -> Unit, onSave: (String) -> Unit) {
    var name by remember(initial) { mutableStateOf(initial) }
    AlertDialog(onDismissRequest = onDismiss, title = { Text(title) }, text = { OutlinedTextField(name, { name = it }, label = { Text(stringResource(R.string.ui_nom)) }, singleLine = true) }, confirmButton = { TextButton({ onSave(name.trim()) }, enabled = name.trim().length in 1..120) { Text(stringResource(R.string.ui_enregistrer_le_nom)) } }, dismissButton = { TextButton(onDismiss) { Text(stringResource(R.string.ui_annuler)) } })
}
@Composable fun EntryHistoryScreen(rows: List<HistoryRow>, onClose: () -> Unit, categoryNames: Map<String, String> = emptyMap()) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(stringResource(R.string.ui_historique_de_la_transaction), style = MaterialTheme.typography.headlineMedium)
        TextButton(onClose) { Text(stringResource(R.string.ui_fermer_lhistorique)) }
        if (rows.isEmpty()) Text(stringResource(R.string.ui_historique_indisponible_sur_ce_telephone_synchronisez_avec_l))
        rows.forEach { row ->
            Text("${row.deviceLabel ?: "Serveur"} · ${row.createdAt}")
            Text("Avant : ${historyDescription(row.before, "Aucune transaction", categoryNames)}")
            Text("Après : ${historyDescription(row.after, "Supprimée", categoryNames)}")
            HorizontalDivider()
        }
    }
}

private fun historyDescription(raw: String?, absent: String, categoryNames: Map<String, String>): String {
    if (raw == null) return absent
    val value = JSONObject(raw)
    val details = mutableListOf<String>()
    if (value.has("amountCents") && !value.isNull("amountCents")) details += formatCadCents(value.getLong("amountCents"))
    EntryKind.entries.find { it.wireValue == value.optString("kind") }?.let { details += it.label }
    if (value.has("entryDate")) details += value.getString("entryDate")
    if (!value.isNull("categoryId")) details += "Catégorie : ${categoryNames[value.getString("categoryId")] ?: "Catégorie indisponible"}"
    if (!value.isNull("account")) details += "Compte : ${value.getString("account")}"
    if (!value.isNull("note") && value.optString("note").isNotBlank()) details += value.getString("note")
    if (!value.isNull("deletedAt")) details += "Supprimée"
    return details.joinToString(" · ").ifEmpty { "Aucun détail" }
}
