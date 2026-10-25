package com.household.budget.ui

import androidx.compose.ui.res.stringResource
import com.household.budget.R
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable

@Composable
fun ReminderSettingsScreen(
    time: String,
    isBusy: Boolean,
    notificationsGranted: Boolean,
    exactAlarmsGranted: Boolean,
    onTimeChange: (String) -> Unit,
    onRequestNotifications: () -> Unit,
    onRequestExactAlarms: () -> Unit,
) {
    var edited by rememberSaveable(time) { mutableStateOf(time) }
    val valid = edited.matches(Regex("([01]\\d|2[0-3]):[0-5]\\d"))
    Column {
        Text(stringResource(R.string.ui_rappels_du_foyer))
        Text(stringResource(R.string.ui_recevez_un_rappel_la_veille_et_le_jour_des_revenus_factures_))
        OutlinedTextField(value = edited, onValueChange = { edited = it }, label = { Text(stringResource(R.string.ui_heure_des_rappels_hh_mm)) }, isError = !valid)
        Button(onClick = { onTimeChange(edited) }, enabled = valid && !isBusy) { Text(stringResource(R.string.ui_enregistrer_lheure)) }
        if (!notificationsGranted) Button(onClick = onRequestNotifications) { Text(stringResource(R.string.ui_autoriser_les_notifications)) }
        if (!exactAlarmsGranted) {
            Text(stringResource(R.string.ui_autorisez_les_alarmes_pour_recevoir_les_rappels_a_lheure_cho))
            Button(onClick = onRequestExactAlarms) { Text(stringResource(R.string.ui_autoriser_les_rappels_precis)) }
        }
    }
}
