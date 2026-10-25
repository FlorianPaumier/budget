package com.household.budget.household

import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.common.BitMatrix
import com.google.zxing.qrcode.QRCodeWriter

/** Encodes the server's payload unchanged; install and pairing QR codes stay separate. */
fun pairingQrMatrix(uri: String): BitMatrix = QRCodeWriter().encode(
    uri, BarcodeFormat.QR_CODE, 512, 512, mapOf(EncodeHintType.MARGIN to 4),
)
