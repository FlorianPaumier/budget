package com.household.budget.ui

import androidx.compose.ui.res.stringResource
import com.household.budget.R
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import org.json.JSONObject

data class ConflictRow(
    val id: String,
    val entityType: String,
    val entityId: String,
    val serverValueJson: String?,
    val proposedValueJson: String,
)
enum class ConflictChoice(val wireValue: String) {
    SERVER("server"), PROPOSED("proposed")
}

@Composable
fun ConflictReviewScreen(
    conflicts: List<ConflictRow>,
    isBusy: Boolean,
    onResolve: (String, ConflictChoice) -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(stringResource(R.string.ui_modifications_a_verifier), style = MaterialTheme.typography.headlineMedium)
        if (conflicts.isEmpty()) Text(stringResource(R.string.ui_aucune_modification_a_verifier))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            items(conflicts, key = { it.id }) { conflict ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(conflict.entityType.replace('_', ' '), style = MaterialTheme.typography.titleMedium)
                        Text("Élément : ${conflict.entityId}")
                        Text(stringResource(R.string.ui_version_du_foyer), style = MaterialTheme.typography.titleSmall)
                        Text(conflict.serverValueJson?.let(::prettyJson) ?: "Supprimé dans le foyer")
                        Text(stringResource(R.string.ui_votre_modification), style = MaterialTheme.typography.titleSmall)
                        Text(proposedDescription(conflict.proposedValueJson))
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(onClick = { onResolve(conflict.id, ConflictChoice.SERVER) }, enabled = !isBusy) {
                                Text(stringResource(R.string.ui_garder_la_version_du_foyer))
                            }
                            Button(onClick = { onResolve(conflict.id, ConflictChoice.PROPOSED) }, enabled = !isBusy) {
                                Text(stringResource(R.string.ui_garder_ma_modification))
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun proposedDescription(json: String): String = try {
    val operation = JSONObject(json)
    if (operation.optString("action") == "delete") "Suppression proposée"
    else operation.optJSONObject("value")?.toString(2) ?: "Suppression proposée"
} catch (_: Exception) { json }

private fun prettyJson(json: String): String = try { JSONObject(json).toString(2) }
catch (_: Exception) { json }
