package com.household.budget.ui

import android.app.Activity
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning

/** Google Play services owns camera access. The payload remains unpaired until the user confirms. */
fun scanPairingQr(activity: Activity, onResult: (String) -> Unit, onError: (String) -> Unit) {
    val options = GmsBarcodeScannerOptions.Builder().setBarcodeFormats(Barcode.FORMAT_QR_CODE).enableAutoZoom().build()
    try {
        GmsBarcodeScanning.getClient(activity, options).startScan()
            .addOnSuccessListener { barcode ->
                val raw = barcode.rawValue
                if (raw.isNullOrBlank()) onError("The QR code is empty. Enter the pairing code manually.") else onResult(raw)
            }
            .addOnFailureListener { onError("QR scanning is unavailable. Check Google Play services or enter the pairing code manually.") }
            .addOnCanceledListener { /* The user can retry or enter the code manually. */ }
    } catch (_: Exception) {
        onError("QR scanning is unavailable. Enter the pairing code manually.")
    }
}
