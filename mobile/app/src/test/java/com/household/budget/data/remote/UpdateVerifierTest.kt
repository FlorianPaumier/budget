package com.household.budget.data.remote

import java.security.KeyPairGenerator
import java.security.Signature
import java.util.Base64
import org.json.JSONObject
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class UpdateVerifierTest {
    private val keys = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
    private val apk = "sample apk bytes".toByteArray()
    private val sha256 = "5d07dbce9ff0d4b5595d91045b9b76d916a7b50322f0489832f39b5b22bd14cf"

    @Test fun acceptsSignedHigherVersionWithMatchingApk() {
        val metadata = signedMetadata(12, sha256)

        assertTrue(UpdateVerifier.verify(metadata, apk, 11, keys.public.encoded))
    }

    @Test fun rejectsModifiedApkDespiteValidMetadataSignature() {
        val metadata = signedMetadata(12, sha256)

        assertFalse(UpdateVerifier.verify(metadata, "other bytes".toByteArray(), 11, keys.public.encoded))
    }

    @Test fun rejectsSameOrLowerVersion() {
        val metadata = signedMetadata(12, sha256)

        assertFalse(UpdateVerifier.verify(metadata, apk, 12, keys.public.encoded))
        assertFalse(UpdateVerifier.verify(metadata, apk, 13, keys.public.encoded))
    }

    @Test fun rejectsMetadataChangedAfterSignature() {
        val metadata = signedMetadata(12, sha256)
        metadata.put("versionName", "1.2.1")

        assertFalse(UpdateVerifier.verify(metadata, apk, 11, keys.public.encoded))
    }

    private fun signedMetadata(versionCode: Int, digest: String): JSONObject {
        // Literal field order and compact encoding match backend/app/services/distribution.ts signedBytes.
        val canonical = """{"versionName":"1.2.0","versionCode":$versionCode,"sha256":"$digest"}"""
        val signer = Signature.getInstance("Ed25519")
        signer.initSign(keys.private)
        signer.update(canonical.toByteArray(Charsets.UTF_8))
        return JSONObject(canonical).put("signature", Base64.getEncoder().encodeToString(signer.sign()))
    }
}
