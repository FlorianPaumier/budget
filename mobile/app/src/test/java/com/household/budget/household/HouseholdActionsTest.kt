package com.household.budget.household

import com.household.budget.data.repository.BudgetGateway
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class HouseholdActionsTest {
    private val id = "11111111-1111-4111-8111-111111111111"
    @Test fun renameTrimsLabelAndUsesExactContract() {
        val actions = HouseholdActions(BudgetGateway { method, path, body ->
            assertEquals("PATCH", method); assertEquals("/api/v1/devices/$id", path)
            assertEquals("Kitchen", body!!.getString("label")); assertEquals(1, body.length())
            JSONObject("""{"data":{"id":"$id","label":"Kitchen","pairedAt":"2026-10-01T00:00:00Z","revokedAt":null}}""")
        })
        assertEquals("Kitchen", actions.renamePhone(id, " Kitchen ").label)
    }
    @Test fun revokeAcceptsEmpty204Response() {
        val actions = HouseholdActions(BudgetGateway { method, path, body ->
            assertEquals("DELETE", method); assertEquals("/api/v1/devices/$id", path); assertNull(body); JSONObject()
        })
        actions.revokePhone(id)
    }
    @Test fun historyPreservesDeviceTimeAndNullCreationBefore() {
        val actions = HouseholdActions(BudgetGateway { _, path, _ ->
            assertEquals("/api/v1/entries/$id/history", path)
            JSONObject("""{"data":[{"id":"$id","deviceLabel":"Kitchen","createdAt":"2026-10-01T12:00:00Z","before":null,"after":{"amountCents":1234}}]}""")
        })
        val row = actions.history(id).single()
        assertEquals("Kitchen", row.deviceLabel); assertNull(row.before)
        assertEquals(1234L, JSONObject(row.after!!).getLong("amountCents")); assertEquals("2026-10-01T12:00:00Z", row.createdAt)
    }
    @Test fun suggestionWithNoSamplesRemainsAbsentAndDoesNotWriteEstimate() {
        var calls = 0
        val actions = HouseholdActions(BudgetGateway { method, path, body ->
            calls++; assertEquals("GET", method); assertNull(body)
            assertEquals("/api/v1/months/2026-10/suggestions/$id", path)
            JSONObject("""{"data":{"categoryId":"$id","month":"2026-10","amountCents":null,"sampleCount":0}}""")
        })
        assertNull(actions.suggestion("2026-10", id).amountCents); assertEquals(1, calls)
    }
    @Test fun pairingUsesReturnedUriAndInvalidatesAllUnusedCodes() {
        val methods = mutableListOf<String>()
        val actions = HouseholdActions(BudgetGateway { method, path, _ ->
            methods += method; assertEquals("/api/v1/pairing-codes", path)
            if (method == "POST") JSONObject("""{"data":{"pairingCode":"secret","pairingUri":"budget://pair?server=https%3A%2F%2Fbudget.home.arpa&code=secret","expiresInSeconds":600}}""") else JSONObject()
        })
        assertEquals(600, actions.createPairing().expiresInSeconds); actions.invalidatePairing()
        assertEquals(listOf("POST", "DELETE"), methods)
    }
}
