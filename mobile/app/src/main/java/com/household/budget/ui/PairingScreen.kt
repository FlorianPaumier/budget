package com.household.budget.ui

import androidx.compose.ui.res.stringResource
import com.household.budget.R
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import java.net.URI

data class PairingUiState(
    val serverUrl: String = "https://192.168.40.71",
    val isBusy: Boolean = false,
    val error: String? = null,
    val connectionMessage: String? = null,
)

@Composable
fun PairingScreen(
    state: PairingUiState,
    onTestConnection: (String) -> Unit,
    onPair: (String, String, String) -> Unit,
    onScanQrCode: (((String) -> Unit, (String) -> Unit) -> Unit)? = null,
) {
    var serverUrl by rememberSaveable(state.serverUrl) { mutableStateOf(state.serverUrl) }
    var label by rememberSaveable { mutableStateOf("") }
    var pairingCode by rememberSaveable { mutableStateOf("") }
    var scanError by rememberSaveable { mutableStateOf<String?>(null) }
    var showValidation by rememberSaveable { mutableStateOf(false) }
    val validOrigin = isHttpsOrigin(serverUrl)
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Text(stringResource(R.string.ui_connecter_ce_telephone), style = MaterialTheme.typography.headlineMedium)
        Text(stringResource(R.string.ui_retrouvez_le_budget_partage_de_votre_foyer))
        OutlinedTextField(
            value = serverUrl, onValueChange = { serverUrl = it },
            label = { Text(stringResource(R.string.ui_adresse_du_serveur)) }, singleLine = true, enabled = !state.isBusy,
            isError = showValidation && !validOrigin, modifier = Modifier.fillMaxWidth(),
        )
        if (showValidation && !validOrigin) Text(stringResource(R.string.ui_saisissez_une_adresse_de_serveur_https))
        TextButton(onClick = { onTestConnection(serverUrl.trim()) }, enabled = !state.isBusy && validOrigin) {
            Text(stringResource(R.string.ui_tester_la_connexion))
        }
        state.connectionMessage?.let { Text(it) }
        OutlinedTextField(
            value = label, onValueChange = { label = it }, label = { Text(stringResource(R.string.ui_nom_de_ce_telephone)) },
            singleLine = true, enabled = !state.isBusy, modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = pairingCode, onValueChange = { pairingCode = it },
            label = { Text(stringResource(R.string.ui_code_de_connexion)) }, singleLine = true, enabled = !state.isBusy,
            modifier = Modifier.fillMaxWidth(),
        )
        if (onScanQrCode != null) TextButton(onClick = {
            scanError = null
            onScanQrCode({ raw ->
                try {
                    val payload = com.household.budget.data.remote.BudgetApi.parsePairingPayload(raw)
                    val origin = requireNotNull(payload.serverUrl) { "QR code must include the household server" }
                    serverUrl = origin
                    pairingCode = payload.pairingCode
                } catch (_: Exception) {
                    scanError = "Ce QR ne contient pas un code de connexion valide."
                }
            }, { message -> scanError = message })
        }, enabled = !state.isBusy) { Text(stringResource(R.string.ui_scanner_le_qr_de_connexion)) }
        scanError?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        Button(
            onClick = {
                showValidation = true
                if (validOrigin && label.isNotBlank() && pairingCode.isNotBlank()) {
                    onPair(serverUrl.trim(), label.trim(), pairingCode.trim())
                }
            },
            enabled = !state.isBusy,
            modifier = Modifier.fillMaxWidth(),
        ) { Text(if (state.isBusy) "Connexion…" else "Connecter le téléphone") }
        if (showValidation && (label.isBlank() || pairingCode.isBlank())) {
            Text(stringResource(R.string.ui_saisissez_un_nom_de_telephone_et_un_code_de_connexion))
        }
    }
}

private fun isHttpsOrigin(raw: String): Boolean = try {
    val uri = URI(raw.trim())
    uri.scheme.equals("https", ignoreCase = true) && !uri.host.isNullOrBlank() &&
        uri.userInfo == null && uri.query == null && uri.fragment == null &&
        (uri.path.isNullOrEmpty() || uri.path == "/")
} catch (_: IllegalArgumentException) { false }
