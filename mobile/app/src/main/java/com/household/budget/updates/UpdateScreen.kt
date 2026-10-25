package com.household.budget.updates

import androidx.compose.ui.res.stringResource
import com.household.budget.R
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable

@Composable fun UpdateScreen(result: UpdateCheck?, busy: Boolean, onCheck: () -> Unit, onInstall: () -> Unit) {
    Column {
        Text(stringResource(R.string.ui_mises_a_jour))
        Button(onCheck, enabled = !busy) { Text(if (busy) "Recherche…" else "Rechercher une mise à jour") }
        when (result) {
            null -> Text(stringResource(R.string.ui_connectez_vous_au_wi_fi_du_foyer_pour_rechercher_une_mise_a_))
            UpdateCheck.Current -> Text(stringResource(R.string.ui_votre_application_est_a_jour))
            is UpdateCheck.Unavailable -> Text(result.message)
            is UpdateCheck.Ready -> {
                Text("La version ${result.versionName} est prête à installer.")
                Button(onInstall, enabled = !busy) { Text(stringResource(R.string.ui_installer_la_mise_a_jour)) }
            }
        }
    }
}
