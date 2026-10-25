package com.household.budget.updates

import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.security.KeyPairGenerator
import java.security.MessageDigest
import java.security.Signature
import java.util.Base64

class UpdateDownloadTest {
    @get:Rule val files = TemporaryFolder()
    @Test fun signedNewApkIsVerifiedBeforeItBecomesInstallable() {
        val apk = "real apk bytes".toByteArray()
        val key = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
        val hash = MessageDigest.getInstance("SHA-256").digest(apk).joinToString("") { "%02x".format(it) }
        val unsigned = "{\"versionName\":\"0.2.0\",\"versionCode\":2,\"sha256\":\"$hash\"}"
        val signature = Signature.getInstance("Ed25519").run { initSign(key.private); update(unsigned.toByteArray()); sign() }
        val metadata = JSONObject(unsigned).put("signature", Base64.getEncoder().encodeToString(signature)).toString()
        val client = client(metadata, apk)
        val folder = files.newFolder()
        val result = UpdateDownload("https://budget.home.arpa", 1, key.public.encoded, folder, client).check()
        assertTrue(result is UpdateCheck.Ready)
        assertArrayEquals(apk, (result as UpdateCheck.Ready).apk.readBytes())
        val invalidFolder = files.newFolder()
        val invalid = UpdateDownload("https://budget.home.arpa", 1, key.public.encoded, invalidFolder, client(metadata, "bad".toByteArray())).check()
        assertTrue(invalid is UpdateCheck.Unavailable)
        assertTrue(invalidFolder.listFiles()!!.isEmpty())
    }
    @Test fun sameVersionDoesNotDownloadApkAndMissingPublicationCannotInstall() {
        val key = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
        val canonical = "{\"versionName\":\"0.1.0\",\"versionCode\":1,\"sha256\":\"${"0".repeat(64)}\"}"
        val signature = Signature.getInstance("Ed25519").run { initSign(key.private); update(canonical.toByteArray()); sign() }
        val metadata = JSONObject(canonical).put("signature", Base64.getEncoder().encodeToString(signature)).toString()
        val paths = mutableListOf<String>()
        val current = OkHttpClient.Builder().addInterceptor { chain ->
            paths += chain.request().url.encodedPath
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(200).message("OK")
                .body(metadata.toResponseBody()).build()
        }.build()
        assertTrue(UpdateDownload("https://budget.home.arpa", 1, key.public.encoded, files.newFolder(), current).check() is UpdateCheck.Current)
        assertEquals(listOf("/install/version.json"), paths)
        val missing = OkHttpClient.Builder().addInterceptor { chain ->
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(404).message("Missing")
                .body("".toResponseBody()).build()
        }.build()
        val folder = files.newFolder()
        assertTrue(UpdateDownload("https://budget.home.arpa", 1, ByteArray(0), folder, missing).check() is UpdateCheck.Unavailable)
        assertTrue(folder.listFiles()!!.isEmpty())
    }
    @Test fun untrustedOrMalformedCurrentMetadataCannotClaimAppIsCurrent() {
        val key = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
        val canonical = "{\"versionName\":\"0.1.0\",\"versionCode\":1,\"sha256\":\"${"0".repeat(64)}\"}"
        val signature = Signature.getInstance("Ed25519").run { initSign(key.private); update(canonical.toByteArray()); sign() }
        val signed = JSONObject(canonical).put("signature", Base64.getEncoder().encodeToString(signature))
        val invalid = listOf(
            "{\"versionCode\":1}",
            JSONObject(signed.toString()).put("versionCode", 0).toString(),
            JSONObject(signed.toString()).put("versionCode", 1.5).toString(),
            JSONObject(signed.toString()).put("signature", Base64.getEncoder().encodeToString(ByteArray(64))).toString(),
        )
        invalid.forEach { metadata ->
            val paths = mutableListOf<String>()
            val connection = OkHttpClient.Builder().addInterceptor { chain ->
                paths += chain.request().url.encodedPath
                Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(200).message("OK")
                    .body(metadata.toResponseBody()).build()
            }.build()
            val folder = files.newFolder()
            assertTrue("Invalid metadata: $metadata", UpdateDownload("https://budget.home.arpa", 1, key.public.encoded, folder, connection).check() is UpdateCheck.Unavailable)
            assertEquals(listOf("/install/version.json"), paths)
            assertTrue(folder.listFiles()!!.isEmpty())
        }
    }
    private fun client(metadata: String, apk: ByteArray) = OkHttpClient.Builder().addInterceptor { chain ->
        Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(200).message("OK")
            .body(if (chain.request().url.encodedPath.endsWith("version.json")) metadata.toResponseBody() else apk.toResponseBody()).build()
    }.build()
}
