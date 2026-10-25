package com.household.budget.data.remote

import com.household.budget.security.PairedDevice
import com.household.budget.security.PairingCredentialStore
import java.net.URI
import java.net.URLDecoder
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

data class Household(
    val id: String,
    val currency: String,
    val timeZone: String,
    val reminderTime: String,
    val openingSpendableCents: Long,
    val openingSavingsCents: Long,
    val openingDate: String,
    val monthlySavingsTargetCents: Long?,
    val revision: Long,
)

data class PairingCode(val code: String, val uri: String, val expiresInSeconds: Int)
data class ParsedPairingPayload(val serverUrl: String?, val pairingCode: String)

class ApiException(val status: Int, val code: String, override val message: String) : Exception(message)

/** Blocking API; call on an IO dispatcher, never on the main thread. */
class BudgetApi(private val store: PairingCredentialStore, private val client: OkHttpClient = OkHttpClient()) {
    fun authenticated(method: String, path: String, body: JSONObject? = null): JSONObject {
        return authenticatedAs(requirePairing(), method, path, body)
    }

    /** A repository binds its requests to the pairing that owns its database. */
    internal fun authenticatedAs(paired: PairedDevice, method: String, path: String, body: JSONObject?): JSONObject =
        request(paired.baseUrl, method, path, body, paired.credential)

    fun health(baseUrl: String): Boolean = request(baseUrl, "GET", "/api/v1/health")
        .getJSONObject("data").getString("status") == "ok"

    fun pair(baseUrl: String, pairingCode: String, label: String): PairedDevice {
        val normalized = normalizedBaseUrl(baseUrl)
        val body = JSONObject().put("pairingCode", pairingCode).put("label", label)
        val data = request(normalized, "POST", "/api/v1/pair", body).getJSONObject("data")
        val paired = PairedDevice(normalized, data.getString("deviceId"),
            data.getString("householdId"), data.getString("credential"))
        store.save(paired)
        return paired
    }

    fun household(): Household {
        val paired = requirePairing()
        val data = request(paired.baseUrl, "GET", "/api/v1/household", bearer = paired.credential)
            .getJSONObject("data")
        return Household(data.getString("id"), data.getString("currency"),
            data.getString("timeZone"), data.getString("reminderTime"),
            data.getLong("openingSpendableCents"), data.getLong("openingSavingsCents"),
            data.getString("openingDate"),
            if (data.isNull("monthlySavingsTargetCents")) null else data.getLong("monthlySavingsTargetCents"),
            data.getLong("revision"))
    }

    fun createPairingCode(): PairingCode {
        val paired = requirePairing()
        val data = request(paired.baseUrl, "POST", "/api/v1/pairing-codes",
            bearer = paired.credential).getJSONObject("data")
        return PairingCode(data.getString("pairingCode"), data.getString("pairingUri"),
            data.getInt("expiresInSeconds"))
    }

    fun invalidatePairingCodes() {
        val paired = requirePairing()
        request(paired.baseUrl, "DELETE", "/api/v1/pairing-codes", bearer = paired.credential)
    }

    private fun requirePairing() = store.load() ?: throw IllegalStateException("Phone is not paired")

    private fun request(baseUrl: String, method: String, path: String,
                        body: JSONObject? = null, bearer: String? = null): JSONObject {
        val relative = URI(path)
        require(relative.scheme == null && relative.authority == null && relative.fragment == null &&
            relative.rawPath.startsWith("/api/v1/") &&
            !relative.rawPath.split('/').any { it == ".." || it == "." } &&
            !relative.rawPath.startsWith("//")) { "Invalid API path" }
        val safeMethod = method.uppercase()
        require(safeMethod in setOf("GET", "POST", "PUT", "PATCH", "DELETE")) { "Invalid API method" }
        val payload = body?.toString()?.toRequestBody("application/json; charset=utf-8".toMediaType())
        val request = Request.Builder().url(normalizedBaseUrl(baseUrl) + path)
            .header("Accept", "application/json")
            .apply { bearer?.let { header("Authorization", "Bearer $it") } }
            .method(safeMethod, payload ?: if (safeMethod in setOf("POST", "PUT", "PATCH"))
                ByteArray(0).toRequestBody() else null).build()
        client.newBuilder().followRedirects(false).followSslRedirects(false).build()
            .newCall(request).execute().use { response ->
            val status = response.code
            val responseText = response.body?.string().orEmpty()
            if (status !in 200..299) {
                val error = runCatching { JSONObject(responseText) }.getOrNull()
                throw ApiException(status, error?.optString("code")?.ifBlank { "HTTP_$status" }
                    ?: "HTTP_$status", error?.optString("message")?.ifBlank { "HTTP $status" }
                    ?: "HTTP $status")
            }
            return if (responseText.isBlank()) JSONObject() else JSONObject(responseText)
        }
    }

    companion object {
        const val DEFAULT_HOME_URL = "https://budget.home.arpa"

        fun parsePairingPayload(raw: String): ParsedPairingPayload {
            val value = raw.trim()
            if (!value.startsWith("budget://")) {
                require(value.length in 32..256 && !value.any(Char::isWhitespace)) {
                    "Invalid pairing code"
                }
                return ParsedPairingPayload(null, value)
            }
            val uri = URI(value)
            require(uri.scheme == "budget" && uri.authority == "pair" &&
                uri.path.isNullOrEmpty() && uri.fragment == null) { "Invalid pairing URI" }
            val parameters = mutableMapOf<String, String>()
            for (part in (uri.rawQuery ?: "").split('&')) {
                val pieces = part.split('=', limit = 2)
                require(pieces.size == 2) { "Invalid pairing URI" }
                val key = URLDecoder.decode(pieces[0], Charsets.UTF_8.name())
                val parameter = URLDecoder.decode(pieces[1], Charsets.UTF_8.name())
                require(key in setOf("server", "code") && parameters.putIfAbsent(key, parameter) == null) {
                    "Invalid pairing URI"
                }
            }
            val code = parameters["code"] ?: throw IllegalArgumentException("Pairing code missing")
            require(code.length in 32..256 && !code.any(Char::isWhitespace)) { "Invalid pairing code" }
            val server = parameters["server"] ?: throw IllegalArgumentException("Pairing server missing")
            return ParsedPairingPayload(normalizedBaseUrl(server), code)
        }

        /** User override must be an HTTPS origin with a hostname; TLS validation stays enabled. */
        fun normalizedBaseUrl(value: String): String {
            val url = URI(value.trim().trimEnd('/'))
            require(url.scheme.equals("https", ignoreCase = true) && !url.host.isNullOrBlank() &&
                url.userInfo == null && url.path.isNullOrEmpty() && url.query == null && url.fragment == null) {
                "Enter an HTTPS server hostname without a path"
            }
            return url.toASCIIString().trimEnd('/')
        }
    }
}
