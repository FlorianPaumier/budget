package com.household.budget.security

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import org.json.JSONObject

data class PairedDevice(
    val baseUrl: String,
    val deviceId: String,
    val householdId: String,
    val credential: String,
)

interface PairingCredentialStore {
    fun load(): PairedDevice?
    fun save(device: PairedDevice)
}

/** The credential is encrypted with a non-exportable Android Keystore key before persistence. */
class PairingStore(context: Context) : PairingCredentialStore {
    private val preferences = context.applicationContext.getSharedPreferences("pairing", Context.MODE_PRIVATE)

    override fun load(): PairedDevice? {
        val encoded = preferences.getString("device", null) ?: return null
        return try {
            val bytes = Base64.decode(encoded, Base64.NO_WRAP)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes.copyOfRange(0, 12)))
            val value = JSONObject(String(cipher.doFinal(bytes.copyOfRange(12, bytes.size)), Charsets.UTF_8))
            PairedDevice(value.getString("baseUrl"), value.getString("deviceId"),
                value.getString("householdId"), value.getString("credential"))
        } catch (_: Exception) {
            // A restored preference with no matching Keystore key must never yield a credential.
            null
        }
    }

    override fun save(device: PairedDevice) {
        val plaintext = JSONObject().put("baseUrl", device.baseUrl)
            .put("deviceId", device.deviceId).put("householdId", device.householdId)
            .put("credential", device.credential).toString().toByteArray(Charsets.UTF_8)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val encoded = Base64.encodeToString(cipher.iv + cipher.doFinal(plaintext), Base64.NO_WRAP)
        check(preferences.edit().putString("device", encoded).commit()) { "Could not save pairing" }
    }

    fun clear() {
        check(preferences.edit().remove("device").commit()) { "Could not remove pairing" }
    }

    private fun key(): SecretKey {
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(KeyGenParameterSpec.Builder(KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256).build())
        return generator.generateKey()
    }

    private companion object { const val KEY_ALIAS = "household_budget_device_v1" }
}
