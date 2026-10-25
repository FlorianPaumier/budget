package com.household.budget.updates

import okhttp3.OkHttpClient
import okhttp3.HttpUrl.Companion.toHttpUrl
import java.io.File

sealed interface UpdateCheck {
    data object Current : UpdateCheck
    data class Ready(val versionName: String, val apk: File) : UpdateCheck
    data class Unavailable(val message: String) : UpdateCheck
}
class UpdateDownload(private val baseUrl: String, private val installedCode: Int,
    private val publicKey: ByteArray, private val directory: File,
    private val client: OkHttpClient = OkHttpClient()) {
    fun check(): UpdateCheck = try {
        val origin = baseUrl.toHttpUrl()
        require(origin.scheme == "https" && origin.encodedPath == "/" && origin.username.isEmpty() && origin.password.isEmpty() && origin.query == null && origin.fragment == null) { "Les mises à jour nécessitent une adresse HTTPS." }
        fun download(path: String, limit: Long): ByteArray {
            val request = okhttp3.Request.Builder().url(origin.resolve(path)!!).build()
            return client.newBuilder().followRedirects(false).followSslRedirects(false).build().newCall(request).execute().use { response ->
                require(response.isSuccessful) { "Serveur de mise à jour indisponible (${response.code})." }
                val body = checkNotNull(response.body)
                require(body.contentLength() <= limit) { "La mise à jour dépasse la taille autorisée." }
                val output = java.io.ByteArrayOutputStream()
                body.byteStream().use { input ->
                    val buffer = ByteArray(8192)
                    while (true) {
                        val count = input.read(buffer)
                        if (count < 0) break
                        require(output.size().toLong() + count <= limit) { "La mise à jour dépasse la taille autorisée." }
                        output.write(buffer, 0, count)
                    }
                }
                output.toByteArray()
            }
        }
        val metadata = org.json.JSONObject(String(download("/install/version.json", 65536), Charsets.UTF_8))
        require(com.household.budget.data.remote.UpdateVerifier.verifyMetadata(metadata, publicKey)) { "Impossible de vérifier les informations de la mise à jour." }
        val code = metadata.getLong("versionCode")
        if (code <= installedCode) UpdateCheck.Current else {
            val apk = download("/install/budget.apk", 100L * 1024 * 1024)
            require(com.household.budget.data.remote.UpdateVerifier.verify(metadata, apk, installedCode, publicKey)) { "Impossible de vérifier l’authenticité de la mise à jour." }
            directory.mkdirs()
            val destination = File(directory, "budget-update.apk")
            val temporary = File(directory, "budget-update.tmp")
            temporary.writeBytes(apk)
            check(temporary.renameTo(destination)) { "Impossible d’enregistrer la mise à jour sur ce téléphone." }
            UpdateCheck.Ready(metadata.getString("versionName"), destination)
        }
    } catch (failure: Exception) { UpdateCheck.Unavailable(failure.message ?: "Mise à jour indisponible.") }
}
