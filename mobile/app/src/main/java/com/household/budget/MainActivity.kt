package com.household.budget

import androidx.compose.ui.res.stringResource
import com.household.budget.R
import android.os.Bundle
import android.os.Build
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.app.AlarmManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.unit.dp
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.FileProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.household.budget.application.*
import com.household.budget.data.local.LedgerEntryEntity
import com.household.budget.household.*
import com.household.budget.recurring.RecurringScreen
import com.household.budget.ui.*
import com.household.budget.updates.*
import java.time.LocalDate
import java.math.BigDecimal

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            val graph = (application as BudgetApplication).graph
            val model: BudgetViewModel = viewModel { BudgetViewModel(graph) }
            val session by model.session.state.collectAsStateWithLifecycle()
            val monthPlan by model.monthPlan.collectAsStateWithLifecycle()
            val previousDashboard by model.previousDashboard.collectAsStateWithLifecycle()
            val statistics by model.statistics.collectAsStateWithLifecycle()
            val insightPeriod by model.insightPeriod.collectAsStateWithLifecycle()
            val insights by model.insights.collectAsStateWithLifecycle()
            val dashboard by model.dashboard.collectAsStateWithLifecycle()
            val selectedMonth by model.selectedMonth.collectAsStateWithLifecycle()
            val categories by model.categories.collectAsStateWithLifecycle()
            val pending by model.pending.collectAsStateWithLifecycle()
            val entries by model.entries.collectAsStateWithLifecycle()
            val conflicts by model.conflicts.collectAsStateWithLifecycle()
            val rules by model.recurringFeatures.rules.collectAsStateWithLifecycle()
            val occurrenceEntries by model.occurrenceEntries.collectAsStateWithLifecycle()
            val occurrences by model.recurringFeatures.occurrences.collectAsStateWithLifecycle()
            val categoryRows by model.householdFeatures.categoryRows.collectAsStateWithLifecycle()
            val deviceRows by model.householdFeatures.deviceRows.collectAsStateWithLifecycle()
            val pairing by model.householdFeatures.pairing.collectAsStateWithLifecycle()
            val historyRows by model.householdFeatures.historyRows.collectAsStateWithLifecycle()
            val historyEntryId by model.householdFeatures.historyEntryId.collectAsStateWithLifecycle()
            val lastSync by model.householdFeatures.lastSync.collectAsStateWithLifecycle()
            val reminderTime by model.reminderTime.collectAsStateWithLifecycle()
            val updateResult by model.updateResult.collectAsStateWithLifecycle()
            val updateBusy by model.updateBusy.collectAsStateWithLifecycle()
            var correctedEntryId by rememberSaveable { mutableStateOf<String?>(null) }
            val correctedEntry = entries.firstOrNull { it.id == correctedEntryId }
            var editing by rememberSaveable { mutableStateOf(false) }
            var section by rememberSaveable { mutableStateOf("budget") }
            var permissionRevision by remember { mutableIntStateOf(0) }
            var installError by remember { mutableStateOf<String?>(null) }
            DisposableEffect(Unit) {
                val observer = LifecycleEventObserver { _, event -> if (event == Lifecycle.Event.ON_RESUME) permissionRevision++ }
                lifecycle.addObserver(observer)
                onDispose { lifecycle.removeObserver(observer) }
            }
            val notificationPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { permissionRevision++ }
            val alarmPermission = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) {
                permissionRevision++
                com.household.budget.reminders.ReminderScheduler(this@MainActivity).restore(graph.clock.instant())
            }
            val notificationsGranted = remember(permissionRevision) { NotificationManagerCompat.from(this@MainActivity).areNotificationsEnabled() }
            val alarmsGranted = remember(permissionRevision) { Build.VERSION.SDK_INT < 31 || getSystemService(AlarmManager::class.java).canScheduleExactAlarms() }
            val canEdit = session.canEdit && !session.busy
            fun addEntry() { correctedEntryId = null; editing = true }
            val preferences = remember { getSharedPreferences("appearance", MODE_PRIVATE) }
            var themePreference by remember { mutableStateOf(runCatching { ThemePreference.valueOf(preferences.getString("theme", "SYSTEM")!!) }.getOrDefault(ThemePreference.SYSTEM)) }
            BudgetTheme(themePreference) {
                if (!session.paired || session.connection == ConnectionState.REVOKED) {
                    PairingScreen(PairingUiState(isBusy = session.busy, error = session.error, connectionMessage = session.connectionMessage),
                        onTestConnection = { model.session.testConnection(it) },
                        onPair = { server, label, code -> model.session.pair(server, label, code) },
                        onScanQrCode = { success, error -> scanPairingQr(this@MainActivity, success, error) })
                } else if (historyEntryId != null) {
                    EntryHistoryScreen(historyRows, model.householdFeatures::closeHistory, categoryRows.associate { it.id to it.name })
                } else {
                    Column(Modifier.fillMaxSize()) {
                        if (session.connection != ConnectionState.CONNECTED || pending.isNotEmpty() || session.error != null) {
                            SyncStatusBanner(
                                summary = when {
                                    session.connection == ConnectionState.SYNCING -> "Synchronisation…"
                                    pending.isNotEmpty() -> "${pending.size} modification(s) à synchroniser"
                                    session.connection == ConnectionState.OFFLINE -> "Hors ligne · vos données sont conservées"
                                    else -> "Connexion à vérifier"
                                }, details = session.error, busy = session.busy, onSync = { model.session.refresh(selectedMonth) })
                        }
                        if (section != "budget") TextButton({ section = "budget" }) { Text(stringResource(R.string.ui_revenir_au_budget)) }
                        when (section) {
                            "conflicts" -> ConflictReviewScreen(conflicts, session.busy, model::resolveConflict)
                            "recurring" -> RecurringScreen(rules, occurrences, pending, categories,
                                LocalDate.now(graph.clock.withZone(dashboard.householdZoneId)).toString(), canEdit, session.busy,
                                model.recurringFeatures::saveRule, model.recurringFeatures::deleteRule, model.recurringFeatures::confirm,
                                occurrenceEntries.mapNotNull { entry -> entry.occurrenceId?.let { it to entry.id } }.toMap(),
                                { model.householdFeatures.showHistory(it) })
                            "household" -> HouseholdManagementScreen(categoryRows, deviceRows, canEdit, pairing,
                                { model.householdFeatures.createCategory(it) },
                                { id, name, active -> model.householdFeatures.updateCategory(id, name, active) },
                                { model.householdFeatures.deleteCategory(it) },
                                { id, label -> model.householdFeatures.renamePhone(id, label) },
                                { model.householdFeatures.revokePhone(it) },
                                { model.householdFeatures.createPairing() }, { model.householdFeatures.invalidatePairing() })
                            "settings" -> Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(16.dp)) {
                                ReminderSettingsScreen(reminderTime, !canEdit, notificationsGranted, alarmsGranted,
                                    model::saveReminderTime,
                                    { if (Build.VERSION.SDK_INT >= 33) notificationPermission.launch(android.Manifest.permission.POST_NOTIFICATIONS)
                                      else startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, packageName)) },
                                    { if (Build.VERSION.SDK_INT >= 31) alarmPermission.launch(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:$packageName"))) })
                                HorizontalDivider(Modifier.padding(vertical = 16.dp))
                                installError?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                                UpdateScreen(updateResult, updateBusy, model::checkUpdate) {
                                    val ready = updateResult as? UpdateCheck.Ready
                                    if (ready != null) try {
                                        if (!packageManager.canRequestPackageInstalls()) {
                                            startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:$packageName")))
                                            installError = "Autorisez Budget à installer des applications, puis réessayez."
                                        } else {
                                            val uri = FileProvider.getUriForFile(this@MainActivity, "$packageName.updates", ready.apk)
                                            startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION))
                                            installError = null
                                        }
                                    } catch (_: Exception) { installError = "Android ne peut pas ouvrir l’installation. Autorisez l’installation d’applications, puis réessayez." }
                                }
                            }
                            else -> BudgetHome(dashboard, model::selectMonth, ::addEntry, canAddEntry = canEdit,
                                modifier = Modifier.weight(1f), insights = insights, statistics = statistics, period = insightPeriod, previousDashboard = previousDashboard,
                                onPeriodSelected = { model.insightPeriod.value = it },
                                profileContent = {
                                    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                        Text(stringResource(R.string.ui_votre_foyer), style = MaterialTheme.typography.headlineMedium)
                                        Text(stringResource(R.string.ui_vos_preferences_vos_appareils_et_votre_foyer), color = MaterialTheme.colorScheme.onSurfaceVariant)
                                        Card { Column(Modifier.fillMaxWidth().padding(20.dp)) {
                                            Text(stringResource(R.string.ui_apparence), style = MaterialTheme.typography.titleMedium)
                                            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                                ThemePreference.entries.forEach { preference ->
                                                    FilterChip(selected = themePreference == preference, onClick = {
                                                        themePreference = preference
                                                        preferences.edit().putString("theme", preference.name).apply()
                                                    }, label = { Text(preference.label) })
                                                }
                                            }
                                        } }
                                        ProfileAction("Opérations régulières", "Factures, abonnements et revenus à venir", "list") { section = "recurring" }
                                        ProfileAction("Foyer", "Catégories et téléphones connectés", "person") { section = "household" }
                                        ProfileAction("Paramètres", "Rappels et mises à jour", "wallet") { section = "settings" }
                                        if (conflicts.isNotEmpty()) OutlinedButton({ section = "conflicts" }, Modifier.fillMaxWidth()) { Text("Modifications à vérifier (${conflicts.size})") }
                                        TextButton({ model.session.refresh(selectedMonth) }, enabled = !session.busy) { Text(stringResource(R.string.ui_synchroniser)) }
                                        lastSync?.let { stamp -> Text("Dernière synchronisation : " + runCatching {
                                            java.time.Instant.parse(stamp).atZone(dashboard.householdZoneId).format(java.time.format.DateTimeFormatter.ofPattern("d MMM · HH:mm", java.util.Locale.CANADA_FRENCH))
                                        }.getOrDefault(stamp), style = MaterialTheme.typography.bodySmall) }
                                        Text("Budget du foyer · ${BuildConfig.VERSION_NAME}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    }
                                }, entriesContent = {
                                    EntriesScreen(entryRowsFromCache(entries.filter { it.entryDate.startsWith(selectedMonth.toString()) }, categories, pending), canEdit, ::addEntry,
                                        { id -> correctedEntryId = id; editing = entries.any { it.id == id } },
                                        model::deleteEntry,
                                        queued = pending.filter { it.entityType == "ledger_entry" }.mapNotNull { operation ->
                                            val value = operation.valueJson?.let { org.json.JSONObject(it) }
                                            val date = value?.optString("entryDate")
                                            if (date?.startsWith(selectedMonth.toString()) != true && entries.none { it.id == operation.entityId }) null
                                            else PendingEntryRow(operation.operationId, operation.action, operation.state, date,
                                                value?.takeIf { it.has("amountCents") }?.getLong("amountCents"), value?.optString("note"), operation.errorCode)
                                        }, onHistory = { model.householdFeatures.showHistory(it) })
                                }, planContent = { PlanScreen(if (monthPlan.month == selectedMonth) monthPlan.estimates else emptyList(), if (monthPlan.month == selectedMonth) monthPlan.savingsTargetCents else null, model::saveEstimate,
                                    model::acceptSuggestion, model::saveSavingsTarget, canEdit = canEdit, spending = insights.categories.associate { it.name to it.cents }) })
                        }
                    }
                    if (editing) {
                        if (correctedEntryId != null && correctedEntry == null) {
                            EntryEditorLoadingDrawer(onCancel = { editing = false })
                        } else {
                            EntryEditor(initial = correctedEntry?.let { entry -> EntryDraft(
                                EntryKind.entries.first { it.wireValue == entry.kind }, entry.entryDate,
                                BigDecimal.valueOf(entry.amountCents, 2).toPlainString(), entry.categoryId,
                                EntryAccount.entries.firstOrNull { it.wireValue == entry.account }, entry.note.orEmpty())
                            } ?: EntryDraft(EntryKind.EXPENSE, selectedMonth.atDay(LocalDate.now(graph.clock.withZone(dashboard.householdZoneId)).dayOfMonth.coerceAtMost(selectedMonth.lengthOfMonth())).toString(), ""),
                                categories = categories, isEditing = correctedEntry != null, isBusy = session.busy,
                                asBottomSheet = true,
                                error = session.error.takeIf { session.connection == ConnectionState.CONNECTED },
                                onSave = { draft -> model.saveEntry(draft, correctedEntry?.id, correctedEntry?.revision ?: 0) { editing = false } },
                                onCancel = { editing = false })
                        }
                    }
                }
            }
        }
    }
}
