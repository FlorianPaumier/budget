package com.household.budget.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun SyncStatusBanner(summary: String, details: String?, busy: Boolean, onSync: () -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Surface(color = MaterialTheme.colorScheme.surfaceVariant) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 12.dp)) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = { expanded = !expanded }, modifier = Modifier.weight(1f)) {
                    Text(summary, style = MaterialTheme.typography.labelMedium)
                }
                TextButton(onClick = onSync, enabled = !busy) { Text(if(busy) "En cours…" else "Réessayer") }
            }
            if(expanded) Text(details ?: "Les données affichées restent enregistrées sur ce téléphone.",
                modifier = Modifier.padding(start = 8.dp, end = 8.dp, bottom = 12.dp), style = MaterialTheme.typography.bodyMedium)
        }
    }
}
