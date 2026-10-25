package com.household.budget.data.remote

import java.security.MessageDigest
import java.util.Base64
import org.bouncycastle.math.ec.rfc8032.Ed25519
import org.json.JSONObject

object UpdateVerifier {
    /** Verifies backend's compact JSON field order, Ed25519 signature, APK hash, and version advance. */
    fun verify(metadata: JSONObject, apk: ByteArray, installedVersionCode: Int, publicKeyDer: ByteArray): Boolean =
        runCatching {
            require(verifyMetadata(metadata, publicKeyDer))
            require(metadata.getLong("versionCode") > installedVersionCode)
            val actualHash = MessageDigest.getInstance("SHA-256").digest(apk)
                .joinToString("") { "%02x".format(it) }
            MessageDigest.isEqual(actualHash.toByteArray(Charsets.US_ASCII),
                metadata.getString("sha256").toByteArray(Charsets.US_ASCII))
        }.getOrDefault(false)

    /** Authenticates publication metadata even when no newer APK needs to be downloaded. */
    fun verifyMetadata(metadata: JSONObject, publicKeyDer: ByteArray): Boolean =
        runCatching {
            require(metadata.length() == 4)
            val versionName = metadata.get("versionName") as String
            val rawVersionCode = metadata.get("versionCode") as Number
            val versionCode = rawVersionCode.toLong()
            val sha256 = metadata.get("sha256") as String
            val signatureBase64 = metadata.get("signature") as String
            require(Regex("^\\d+\\.\\d+\\.\\d+$").matches(versionName))
            require(versionCode in 1..Int.MAX_VALUE.toLong())
            require(rawVersionCode.toString() == versionCode.toString())
            require(Regex("^[0-9a-f]{64}$").matches(sha256))
            val canonical = "{\"versionName\":${JSONObject.quote(versionName)},\"versionCode\":$versionCode,\"sha256\":\"$sha256\"}"
            val spkiPrefix = byteArrayOf(
                0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
            )
            require(publicKeyDer.size == spkiPrefix.size + Ed25519.PUBLIC_KEY_SIZE &&
                publicKeyDer.copyOfRange(0, spkiPrefix.size).contentEquals(spkiPrefix))
            val signature = Base64.getDecoder().decode(signatureBase64)
            require(signature.size == Ed25519.SIGNATURE_SIZE)
            val message = canonical.toByteArray(Charsets.UTF_8)
            Ed25519.verify(signature, 0, publicKeyDer, spkiPrefix.size, message, 0, message.size)
        }.getOrDefault(false)
}
