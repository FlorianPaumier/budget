package com.household.budget.application

import com.household.budget.data.remote.ApiException
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Test
import java.io.IOException
import java.time.YearMonth

class BudgetSessionTest {
    @Test fun `successful pairing keeps access when first data refresh is offline`() = runTest {
        val services = TestServices().apply { refreshFailure = IOException("Home server unreachable") }
        val session = BudgetSession(services, backgroundScope, initiallyPaired = false)
        session.pair("https://budget.home.arpa", "Phone", "one-use-code").join()
        assertTrue(session.state.value.paired)
        assertEquals(ConnectionState.OFFLINE, session.state.value.connection)
        assertFalse(session.state.value.busy)
    }
    @Test fun `first refresh after pairing uses injected household month`() = runTest {
        var refreshed: YearMonth? = null
        val services = object : BudgetSessionServices {
            override suspend fun health(url: String) = true
            override suspend fun pair(url: String, code: String, label: String) = Unit
            override suspend fun refresh(month: YearMonth) { refreshed = month }
        }
        val session = BudgetSession(services, backgroundScope, initiallyPaired = false,
            pairingMonth = { YearMonth.of(2027, 3) })

        session.pair("https://budget.home.arpa", "Phone", "one-use-code").join()

        assertEquals(YearMonth.of(2027, 3), refreshed)
    }

    @Test fun `revoked access blocks mutations without clearing pending work`() = runTest {
        val services = TestServices().apply { refreshFailure = ApiException(401, "DEVICE_REVOKED", "Device revoked") }
        val session = BudgetSession(services, backgroundScope, initiallyPaired = true)
        session.refresh(YearMonth.of(2026, 10)).join()
        assertEquals(ConnectionState.REVOKED, session.state.value.connection)
        assertTrue(session.state.value.paired)
        assertFalse(session.state.value.canEdit)
    }

    @Test fun `failed pairing leaves first run available and shows an error`() = runTest {
        val services = TestServices().apply { pairFailure = ApiException(422, "INVALID_PAIRING_CODE", "Expired code") }
        val session = BudgetSession(services, backgroundScope, initiallyPaired = false)
        session.pair("https://budget.home.arpa", "Phone", "old-code").join()
        assertFalse(session.state.value.paired)
        assertNotNull(session.state.value.error)
        assertFalse(session.state.value.busy)
    }

    @Test fun `reachable health check is reported without claiming phone is paired`() = runTest {
        val session = BudgetSession(TestServices(), backgroundScope, initiallyPaired = false)
        session.testConnection("https://budget.home.arpa").join()
        assertNotNull(session.state.value.connectionMessage)
        assertFalse(session.state.value.paired)
    }

    @Test fun `offline entry is committed before its network refresh fails`() = runTest {
        val services = TestServices().apply { refreshFailure = IOException("Offline") }
        val session = BudgetSession(services, backgroundScope, initiallyPaired = true)
        var stored = false
        var shownSaved = false
        session.mutate(YearMonth.of(2026, 10), action = { stored = true }, onStored = { shownSaved = true }).join()
        assertTrue(stored)
        assertTrue(shownSaved)
        assertEquals(ConnectionState.OFFLINE, session.state.value.connection)
    }
    @Test fun `local write failure stays visible without a success callback`() = runTest {
        val session = BudgetSession(TestServices(), backgroundScope, initiallyPaired = true)
        var shownSaved = false
        session.mutate(YearMonth.of(2026, 10), action = { throw IllegalStateException("Disk full") }, onStored = { shownSaved = true }).join()
        assertFalse(shownSaved)
        assertNotNull(session.state.value.error)
    }
    @Test fun `revocation during direct online action pauses protected actions`() = runTest {
        val session = BudgetSession(TestServices(), backgroundScope, initiallyPaired = true)
        session.mutate(YearMonth.of(2026, 10), action = { throw ApiException(401, "unauthorized", "Revoked") }, onStored = {}).join()
        assertEquals(ConnectionState.REVOKED, session.state.value.connection)
        assertFalse(session.state.value.canEdit)
    }

    private class TestServices : BudgetSessionServices {
        var refreshFailure: Exception? = null
        var pairFailure: Exception? = null
        override suspend fun health(url: String): Boolean = true
        override suspend fun pair(url: String, code: String, label: String) { pairFailure?.let { throw it } }
        override suspend fun refresh(month: YearMonth) { refreshFailure?.let { throw it } }
    }
}
