package cz.veevoy.ansora.core.mobile

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

private fun hex(bytes: ByteArray): String = bytes.joinToString("") { "%02x".format(it) }

class Argon2Test {
  @Test
  fun `CAP-001-R25 matches the Argon2id vector of RFC 9106 section 5 3`() {
    val tag = Argon2.hash(
      password = ByteArray(32) { 1 },
      salt = ByteArray(16) { 2 },
      secret = ByteArray(8) { 3 },
      associatedData = ByteArray(12) { 4 },
      parameters = Argon2.Parameters(memoryKiB = 32, passes = 3, parallelism = 4, tagLength = 32),
    )
    assertEquals("0d640df58d78766c08c037a34a8b53c9d01ef0452d75b65eb52520e96b01e659", hex(tag))
  }

  @Test
  fun `CAP-001-S16 derives the key of a PIN like the reference implementation and a wrong PIN differs`() {
    val parameters = Argon2.Parameters(memoryKiB = 1024, passes = 3, parallelism = 1, tagLength = 32)
    val salt = "0123456789abcdef".toByteArray()
    assertEquals(
      "fb8b9cdc061dbbf25530cf6f5ee61697b53203c9873cca973b3e70dc6fce0431",
      hex(Argon2.hash("123456".toByteArray(), salt, parameters = parameters)),
    )
    assertEquals(
      "b9cd4d1fe3b4463537e44051a2990afecf20e2ccd39e2893c639693390732dcd",
      hex(Argon2.hash("123457".toByteArray(), salt, parameters = parameters)),
    )
    assertEquals(
      "8a77ecf9328aa58ad69749eb3ea74d986a39694553e088aa115098971e8543b8",
      hex(Argon2.hash("4217".toByteArray(), salt, parameters = parameters)),
    )
  }

  @Test
  fun `derives the key with the parameters of the PIN seed`() {
    val tag = Argon2.hash("123456".toByteArray(), "0123456789abcdef".toByteArray(), parameters = PinAccounts.KEY_PARAMETERS)
    assertEquals("430c657f7e8dcf433e1bc1946618ef5cec7b923623787ee7c3d7be8bba71242a", hex(tag))
    assertNotEquals(hex(tag), hex(Argon2.hash("123456".toByteArray(), "fedcba9876543210".toByteArray(), parameters = PinAccounts.KEY_PARAMETERS)))
  }

  @Test
  fun `BLAKE2b matches RFC 7693 appendix A`() {
    assertEquals(
      "ba80a53f981c4d0d6a2797b69f12f6e94c212f14685ac4b74b12bb6fdbffa2d17d87c5392aab792dc252d5de4533cc9518d38aa8dbf1925ab92386edd4009923",
      hex(Blake2b.hash("abc".toByteArray(), 64)),
    )
  }
}
