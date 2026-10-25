package com.household.budget.household

import com.household.budget.data.repository.BudgetGateway
import com.household.budget.data.remote.PairingCode
import java.time.YearMonth
import java.util.UUID
import org.json.JSONObject

data class PhoneRow(val id: String, val label: String, val pairedAt: String, val revokedAt: String?)
data class HistoryRow(val id: String, val deviceLabel: String?, val createdAt: String, val before: String?, val after: String?)
data class SpendingSuggestion(val categoryId: String, val month: String, val amountCents: Long?, val sampleCount: Int)
/** Blocking online household controls. Cache read responses in the owning household database. */
class HouseholdActions(private val gateway: BudgetGateway) {
    fun renamePhone(id: String, label: String): PhoneRow {
        checkId(id)
        val name = label.trim()
        require(name.length in 1..120) { "Phone name must contain 1–120 characters" }
        return parsePhone(gateway.request("PATCH", "/api/v1/devices/$id", JSONObject().put("label", name)).getJSONObject("data"))
    }
    fun revokePhone(id: String) { checkId(id); gateway.request("DELETE", "/api/v1/devices/$id", null) }
    fun historyJson(id: String): String { checkId(id); return gateway.request("GET", "/api/v1/entries/$id/history", null).toString() }
    fun history(id: String): List<HistoryRow> = parseHistory(historyJson(id))
    fun suggestionJson(month: String, categoryId: String): String {
        require(YearMonth.parse(month).toString() == month) { "Invalid month" }; checkId(categoryId)
        return gateway.request("GET", "/api/v1/months/$month/suggestions/$categoryId", null).toString()
    }
    fun suggestion(month: String, categoryId: String): SpendingSuggestion = parseSuggestion(suggestionJson(month, categoryId))
    fun createPairing(): PairingCode {
        val data = gateway.request("POST", "/api/v1/pairing-codes", null).getJSONObject("data")
        return PairingCode(data.getString("pairingCode"), data.getString("pairingUri"), data.getInt("expiresInSeconds"))
    }
    fun invalidatePairing() { gateway.request("DELETE", "/api/v1/pairing-codes", null) }
    companion object {
        private fun checkId(id: String) { require(UUID.fromString(id).toString() == id.lowercase()) { "Invalid ID" } }
        private fun parsePhone(data: JSONObject) = PhoneRow(data.getString("id"), data.getString("label"), data.getString("pairedAt"), data.nullableString("revokedAt"))
        fun parseHistory(raw: String): List<HistoryRow> {
            val data = JSONObject(raw).getJSONArray("data")
            return (0 until data.length()).map { index ->
                val row = data.getJSONObject(index)
                HistoryRow(row.getString("id"), row.nullableString("deviceLabel"), row.getString("createdAt"), row.optJSONObject("before")?.toString(), row.optJSONObject("after")?.toString())
            }
        }
        fun parseSuggestion(raw: String): SpendingSuggestion {
            val data = JSONObject(raw).getJSONObject("data")
            return SpendingSuggestion(data.getString("categoryId"), data.getString("month"), if (data.isNull("amountCents")) null else data.getLong("amountCents"), data.getInt("sampleCount"))
        }
        private fun JSONObject.nullableString(key: String): String? = if (isNull(key)) null else getString(key)
    }
}
