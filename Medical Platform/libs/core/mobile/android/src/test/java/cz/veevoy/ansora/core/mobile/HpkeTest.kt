package cz.veevoy.ansora.core.mobile

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertThrows
import org.junit.Test

// Test vector of the CFRG for DHKEM(P-256, HKDF-SHA256), HKDF-SHA256, AES-256-GCM in base mode
// (https://github.com/cfrg/draft-irtf-cfrg-hpke, test-vectors.json; mode 0, kem 0x0010, kdf 0x0001, aead 0x0002).
private const val INFO = "4f6465206f6e2061204772656369616e2055726e"
private const val PK_RM = "04abc7e49a4c6b3566d77d0304addc6ed0e98512ffccf505e6a8e3eb25c685136f853148544876de76c0f2ef99cdc3a05ccf5ded7860c7c021238f9e2073d2356c"
private const val PK_EM = "04c06b4f6bebc7bb495cb797ab753f911aff80aefb86fd8b6fcc35525f3ab5f03e0b21bd31a86c6048af3cb2d98e0d3bf01da5cc4c39ff5370d331a4f1f7d5a4e0"
private const val SK_EM = "90345e3a1d116c1dd39ae76d95ab858c142223a63e44f8f85318cfa91a84858e"
private const val AAD = "436f756e742d30"
private const val PLAINTEXT = "4265617574792069732074727574682c20747275746820626561757479"
private const val CIPHERTEXT = "58c61a45059d0c5704560e9d88b564a8b63f1364b8d1fcb3c4c6ddc1d291742465e902cd216f8908da49f8f96f"

private fun hex(text: String): ByteArray = text.chunked(2).map { it.toInt(16).toByte() }.toByteArray()

class HpkeTest {
  @Test
  fun `CAP-021-R21 seals the CFRG vector with its ephemeral key to the vector's enc and ciphertext`() {
    val ephemeral = Hpke.keyPairOf(hex(SK_EM), hex(PK_EM))
    val sealed = Hpke.seal(hex(PLAINTEXT), hex(PK_RM), hex(INFO), hex(AAD), ephemeral)
    assertArrayEquals(hex(PK_EM), sealed.enc)
    assertArrayEquals(hex(CIPHERTEXT), sealed.ciphertext)
  }

  @Test
  fun `serializes a public key as the uncompressed point`() {
    assertArrayEquals(hex(PK_RM), Hpke.serializePublicKey(Hpke.deserializePublicKey(hex(PK_RM))))
  }

  @Test
  fun `refuses a recipient key that is not a point on P-256`() {
    val offCurve = hex(PK_RM).also { it[it.size - 1] = (it[it.size - 1].toInt() xor 0x01).toByte() }
    assertThrows(Hpke.InvalidRecipientKeyException::class.java) { Hpke.seal(hex(PLAINTEXT), offCurve) }
    assertThrows(Hpke.InvalidRecipientKeyException::class.java) { Hpke.seal(hex(PLAINTEXT), hex(PK_RM).copyOfRange(1, 65)) }
  }
}
