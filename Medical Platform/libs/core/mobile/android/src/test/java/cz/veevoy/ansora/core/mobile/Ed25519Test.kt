package cz.veevoy.ansora.core.mobile

import java.math.BigInteger
import java.security.KeyFactory
import java.security.PublicKey
import java.security.Signature
import java.security.spec.EdECPoint
import java.security.spec.EdECPublicKeySpec
import java.security.spec.NamedParameterSpec
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

private fun hex(bytes: ByteArray): String = bytes.joinToString("") { "%02x".format(it) }
private fun bytes(hex: String): ByteArray = hex.chunked(2).map { it.toInt(16).toByte() }.toByteArray()

private fun publicKey(seed: ByteArray): PublicKey {
  val encoded = Ed25519.publicKeyBytes(seed)
  val y = BigInteger(1, encoded.reversedArray().also { it[0] = (it[0].toInt() and (Ed25519.SIGN_BIT - 1)).toByte() })
  val xOdd = (encoded[Ed25519.SEED_BYTES - 1].toInt() and Ed25519.SIGN_BIT) != 0
  return KeyFactory.getInstance("Ed25519").generatePublic(EdECPublicKeySpec(NamedParameterSpec.ED25519, EdECPoint(xOdd, y)))
}

class Ed25519Test {
  @Test
  fun `derives the public keys of the RFC 8032 test vectors`() {
    assertEquals(
      "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a",
      hex(Ed25519.publicKeyBytes(bytes("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60"))),
    )
    assertEquals(
      "3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c",
      hex(Ed25519.publicKeyBytes(bytes("4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb"))),
    )
  }

  @Test
  fun `CAP-001-R25 a signature by the seed's private key verifies with the derived public key`() {
    val seed = bytes("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60")
    val message = ByteArray(0)
    val signature = Signature.getInstance("Ed25519").apply {
      initSign(Ed25519.privateKey(seed))
      update(message)
    }.sign()
    assertEquals(
      "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b",
      hex(signature),
    )
    val verified = Signature.getInstance("Ed25519").apply {
      initVerify(publicKey(seed))
      update(message)
    }.verify(signature)
    assertTrue(verified)
  }

  @Test
  fun `CAP-001-R25 the private key reaches the platform as PKCS 8`() {
    val seed = bytes("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60")
    val key = Ed25519.privateKey(seed)
    assertEquals("PKCS#8", key.format)
    assertEquals("302e020100300506032b657004220420" + hex(seed), hex(key.encoded))
  }
}
