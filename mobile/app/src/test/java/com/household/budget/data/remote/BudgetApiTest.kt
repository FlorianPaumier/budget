package com.household.budget.data.remote

import com.household.budget.security.PairedDevice
import com.household.budget.security.PairingCredentialStore
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.tls.HandshakeCertificates
import okhttp3.tls.HeldCertificate
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertNull
import org.junit.Test

class BudgetApiTest {
    private val store = MemoryStore(PairedDevice("https://budget.home.arpa", "device-id", "household-id", "secret-token"))

    @Test fun authenticatedSendsBearerAndReturnsEnvelope() {
        var seenAuthorization: String? = null
        var seenPath: String? = null
        val api = BudgetApi(store, client { chain ->
            seenAuthorization = chain.request().header("Authorization")
            seenPath = chain.request().url.encodedPath
            response(chain, 200, """{"data":{"value":42}}""")
        })

        val result = api.authenticated("GET", "/api/v1/balances")

        assertEquals("Bearer secret-token", seenAuthorization)
        assertEquals("/api/v1/balances", seenPath)
        assertEquals(42, result.getJSONObject("data").getInt("value"))
    }

    @Test fun apiErrorPreservesCodeAndMessage() {
        val api = BudgetApi(store, client { chain ->
            response(chain, 409, """{"code":"REVISION_CONFLICT","message":"Stale revision"}""")
        })

        val error = assertThrows(ApiException::class.java) {
            api.authenticated("POST", "/api/v1/entries", JSONObject().put("amountCents", 100))
        }

        assertEquals(409, error.status)
        assertEquals("REVISION_CONFLICT", error.code)
        assertEquals("Stale revision", error.message)
    }

    @Test fun redirectIsNotFollowedWithCredential() {
        var requestCount = 0
        val api = BudgetApi(store, client { chain ->
            requestCount++
            response(chain, 302, "", "https://other.example/api/v1/balances")
        })

        assertThrows(ApiException::class.java) { api.authenticated("GET", "/api/v1/balances") }
        assertEquals(1, requestCount)
    }

    @Test fun rejectsPathThatCanEscapeApiOrigin() {
        val api = BudgetApi(store, client { chain -> response(chain, 200, "{}") })
        assertThrows(IllegalArgumentException::class.java) {
            api.authenticated("GET", "https://other.example/steal")
        }
        assertThrows(IllegalArgumentException::class.java) {
            api.authenticated("GET", "/api/v1/../steal")
        }
    }

    @Test fun unauthorizedResponseKeepsCredentialForExplicitRecovery() {
        val api = BudgetApi(store, client { chain ->
            response(chain, 401, """{"code":"UNAUTHORIZED","message":"Device revoked"}""")
        })

        val error = assertThrows(ApiException::class.java) { api.authenticated("GET", "/api/v1/household") }

        assertEquals(401, error.status)
        assertEquals("UNAUTHORIZED", error.code)
        assertEquals("secret-token", store.load()?.credential)
    }

    @Test fun pairingUriExtractsHttpsServerAndCode() {
        val code = "a".repeat(32)
        val parsed = BudgetApi.parsePairingPayload(
            "budget://pair?server=https%3A%2F%2Fbudget.home.arpa&code=$code")
        assertEquals("https://budget.home.arpa", parsed.serverUrl)
        assertEquals(code, parsed.pairingCode)
    }

    @Test fun manualPairingCodeTrimsWhitespaceWithoutChangingCode() {
        val code = "b".repeat(32)
        val parsed = BudgetApi.parsePairingPayload("  $code  ")
        assertNull(parsed.serverUrl)
        assertEquals(code, parsed.pairingCode)
    }

    @Test fun pairingUriRejectsInsecureOrAmbiguousServer() {
        val code = "c".repeat(32)
        assertThrows(IllegalArgumentException::class.java) {
            BudgetApi.parsePairingPayload("budget://pair?server=http%3A%2F%2Fbudget.home.arpa&code=$code")
        }
        assertThrows(IllegalArgumentException::class.java) {
            BudgetApi.parsePairingPayload("budget://pair?server=https%3A%2F%2Fgood.home.arpa&server=https%3A%2F%2Fevil.example&code=$code")
        }
    }

    @Test fun pairOverTrustedTlsSavesDeviceAndSendsExactPayload() {
        val certificate = HeldCertificate.Builder().commonName("localhost")
            .addSubjectAlternativeName("localhost").build()
        val server = tlsServer(certificate)
        try {
            server.enqueue(MockResponse().setResponseCode(201).setBody(
                """{"data":{"deviceId":"phone-1","householdId":"home-1","credential":"issued-secret"}}"""))
            val client = trustedClient(certificate)
            val pairingStore = MemoryStore(null)

            val paired = BudgetApi(pairingStore, client).pair(server.url("/").toString(), "123456", "Kitchen phone")

            val request = server.takeRequest()
            val requestJson = JSONObject(request.body.readUtf8())
            assertEquals("POST", request.method)
            assertEquals("/api/v1/pair", request.path)
            assertEquals("123456", requestJson.getString("pairingCode"))
            assertEquals("Kitchen phone", requestJson.getString("label"))
            assertNull(request.getHeader("Authorization"))
            assertEquals("issued-secret", paired.credential)
            assertEquals(paired, pairingStore.load())
        } finally { server.shutdown() }
    }

    @Test fun untrustedTlsCertificateDoesNotSavePairing() {
        val certificate = HeldCertificate.Builder().commonName("localhost")
            .addSubjectAlternativeName("localhost").build()
        val server = tlsServer(certificate)
        try {
            server.enqueue(MockResponse().setResponseCode(201).setBody(
                """{"data":{"deviceId":"phone-1","householdId":"home-1","credential":"issued-secret"}}"""))
            val pairingStore = MemoryStore(null)

            assertThrows(Exception::class.java) {
                BudgetApi(pairingStore).pair(server.url("/").toString(), "123456", "Kitchen phone")
            }
            assertNull(pairingStore.load())
        } finally { server.shutdown() }
    }

    @Test fun hostnameMismatchDoesNotSavePairing() {
        val certificate = HeldCertificate.Builder().commonName("localhost")
            .addSubjectAlternativeName("localhost").build()
        val server = tlsServer(certificate)
        try {
            server.enqueue(MockResponse().setResponseCode(201).setBody(
                """{"data":{"deviceId":"phone-1","householdId":"home-1","credential":"issued-secret"}}"""))
            val pairingStore = MemoryStore(null)
            val wrongHostname = server.url("/").newBuilder().host("127.0.0.1").build().toString()

            assertThrows(Exception::class.java) {
                BudgetApi(pairingStore, trustedClient(certificate))
                    .pair(wrongHostname, "123456", "Kitchen phone")
            }
            assertNull(pairingStore.load())
        } finally { server.shutdown() }
    }

    private fun tlsServer(certificate: HeldCertificate): MockWebServer = MockWebServer().apply {
        val certificates = HandshakeCertificates.Builder().heldCertificate(certificate).build()
        useHttps(certificates.sslSocketFactory(), false)
        start()
    }

    private fun trustedClient(certificate: HeldCertificate): OkHttpClient {
        val certificates = HandshakeCertificates.Builder()
            .addTrustedCertificate(certificate.certificate).build()
        return OkHttpClient.Builder().sslSocketFactory(certificates.sslSocketFactory(), certificates.trustManager).build()
    }

    private fun client(interceptor: Interceptor): OkHttpClient = OkHttpClient.Builder()
        .addInterceptor(interceptor).build()

    private fun response(chain: Interceptor.Chain, status: Int, body: String, location: String? = null): Response {
        val builder = Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1)
            .code(status).message("test").body(body.toResponseBody())
        if (location != null) builder.header("Location", location)
        return builder.build()
    }

    private class MemoryStore(private var device: PairedDevice?) : PairingCredentialStore {
        override fun load(): PairedDevice? = device
        override fun save(device: PairedDevice) { this.device = device }
    }
}
