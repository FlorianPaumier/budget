package com.household.budget.application

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.CancellationException
import com.household.budget.data.remote.ApiException
import java.io.IOException
import java.net.UnknownHostException
import javax.net.ssl.SSLException
import java.time.YearMonth

enum class ConnectionState { UNPAIRED, CONNECTED, OFFLINE, SYNCING, ERROR, REVOKED }
data class SessionState(
    val paired: Boolean,
    val connection: ConnectionState,
    val busy: Boolean = false,
    val error: String? = null,
    val connectionMessage: String? = null,
) { val canEdit: Boolean get() = paired && connection != ConnectionState.REVOKED }
interface BudgetSessionServices {
    suspend fun health(url: String): Boolean
    suspend fun pair(url: String, code: String, label: String)
    suspend fun refresh(month: YearMonth)
}
class BudgetSession(private val services: BudgetSessionServices, private val scope: CoroutineScope,
                    initiallyPaired: Boolean, private val pairingMonth: suspend () -> YearMonth = { YearMonth.now() }) {
    private val mutableState = MutableStateFlow(SessionState(initiallyPaired, if (initiallyPaired) ConnectionState.OFFLINE else ConnectionState.UNPAIRED))
    val state: StateFlow<SessionState> = mutableState
    fun pair(url: String, label: String, code: String): Job = scope.launch {
        if (state.value.busy) return@launch
        mutableState.value = state.value.copy(busy = true, error = null)
        try {
            services.pair(url, code, label)
            mutableState.value = state.value.copy(paired = true, connection = ConnectionState.SYNCING)
            services.refresh(pairingMonth())
            mutableState.value = state.value.copy(connection = ConnectionState.CONNECTED, busy = false)
        } catch (failure: Exception) {
            fail(failure)
        }
    }

    fun refresh(month: YearMonth): Job = scope.launch {
        if (!state.value.paired || state.value.busy || state.value.connection == ConnectionState.REVOKED) return@launch
        mutableState.value = state.value.copy(busy = true, error = null, connection = ConnectionState.SYNCING)
        try {
            services.refresh(month)
            mutableState.value = state.value.copy(connection = ConnectionState.CONNECTED, busy = false)
        } catch (failure: Exception) {
            fail(failure)
        }
    }

    fun testConnection(url: String): Job = scope.launch {
        if (state.value.busy) return@launch
        mutableState.value = state.value.copy(busy = true, error = null, connectionMessage = null)
        try {
            check(services.health(url)) { "Le serveur ne répond pas correctement." }
            mutableState.value = state.value.copy(busy = false, connectionMessage = "Serveur du foyer accessible")
        } catch (failure: Exception) {
            fail(failure)
        }
    }

    fun mutate(month: YearMonth, action: suspend () -> Unit, onStored: () -> Unit): Job = scope.launch {
        if (!state.value.canEdit || state.value.busy) return@launch
        mutableState.value = state.value.copy(busy = true, error = null)
        try {
            action()
        } catch (failure: Exception) {
            if (failure is CancellationException) throw failure
            if (failure is ApiException || failure is IOException) { fail(failure); return@launch }
            mutableState.value = state.value.copy(busy = false, connection = ConnectionState.ERROR,
                error = "Impossible d’enregistrer sur ce téléphone : ${failure.message ?: "stockage indisponible"}")
            return@launch
        }
        onStored()
        try {
            services.refresh(month)
            mutableState.value = state.value.copy(busy = false, connection = ConnectionState.CONNECTED)
        } catch (failure: Exception) {
            fail(failure)
        }
    }

    fun markRevoked() {
        mutableState.value = state.value.copy(connection = ConnectionState.REVOKED,
            error = "Ce téléphone a été déconnecté du foyer. Reconnectez-le ; ses modifications locales sont conservées.")
    }

    private fun fail(failure: Exception) {
        if (failure is CancellationException) throw failure
        val connection = when {
            failure is ApiException && failure.status == 401 -> ConnectionState.REVOKED
            failure is IOException -> ConnectionState.OFFLINE
            else -> ConnectionState.ERROR
        }
        val message = when (failure) {
            is SSLException -> "Le certificat du serveur ne peut pas être validé. Vérifiez l’adresse du foyer."
            is UnknownHostException -> "Le serveur est introuvable. Connectez-vous au Wi-Fi du foyer."
            is IOException -> "Serveur du foyer indisponible. Vos données et modifications restent enregistrées sur ce téléphone."
            else -> failure.message ?: "L’opération n’a pas abouti."
        }
        mutableState.value = state.value.copy(busy = false, connection = connection, error = message)
    }
}
