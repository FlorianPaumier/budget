package com.household.budget.household

import com.google.zxing.BinaryBitmap
import com.google.zxing.LuminanceSource
import com.google.zxing.common.HybridBinarizer
import com.google.zxing.qrcode.QRCodeReader
import org.junit.Assert.assertEquals
import org.junit.Test

class PairingQrTest {
    @Test fun renderedQrDecodesToExactBackendPairingUri() {
        val uri = "budget://pair?server=https%3A%2F%2Fbudget.home.arpa&code=" + "a".repeat(64)
        val matrix = pairingQrMatrix(uri)
        val pixels = ByteArray(matrix.width * matrix.height) { index -> if (matrix[index % matrix.width, index / matrix.width]) 0 else 255.toByte() }
        val source = object : LuminanceSource(matrix.width, matrix.height) {
            override fun getRow(y: Int, row: ByteArray?): ByteArray = pixels.copyOfRange(y * width, (y + 1) * width)
            override fun getMatrix(): ByteArray = pixels
        }
        assertEquals(uri, QRCodeReader().decode(BinaryBitmap(HybridBinarizer(source))).text)
    }
}
