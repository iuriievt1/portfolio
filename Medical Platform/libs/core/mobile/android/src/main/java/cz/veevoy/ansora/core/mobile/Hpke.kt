package cz.veevoy.ansora.core.mobile

import java.math.BigInteger
import java.security.AlgorithmParameters
import java.security.KeyFactory
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.PrivateKey
import java.security.PublicKey
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec
import java.security.spec.ECParameterSpec
import java.security.spec.ECPoint
import java.security.spec.ECPrivateKeySpec
import java.security.spec.ECPublicKeySpec
import javax.crypto.Cipher
import javax.crypto.KeyAgreement
import javax.crypto.Mac
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * HPKE (RFC 9180) sealing for one suite — DHKEM(P-256, HKDF-SHA256), HKDF-SHA256, AES-256-GCM,
 * base mode, one message: the envelope of the file copy sent to the server ✓ CAP-009-R13,
 * CAP-021-R21. Built on the JCA primitives of the platform; the server opens it with the same
 * construction and both are checked against the vectors of the RFC.
 */
internal object Hpke {
  class Sealed(val enc: ByteArray, val ciphertext: ByteArray)

  class InvalidRecipientKeyException : IllegalArgumentException("The recipient key is not an uncompressed point on P-256")

  const val SUITE = "DHKEM(P-256, HKDF-SHA256), HKDF-SHA256, AES-256-GCM"

  private const val KEM_ID = 0x0010
  private const val KDF_ID = 0x0001
  private const val AEAD_ID = 0x0002
  private const val MODE_BASE: Byte = 0x00
  private const val SHARED_SECRET_BYTES = 32
  private const val KEY_BYTES = 32
  private const val NONCE_BYTES = 12
  private const val HASH_BYTES = 32
  private const val TAG_BITS = 128
  private const val COORDINATE_BYTES = 32
  private const val POINT_BYTES = 1 + 2 * COORDINATE_BYTES
  private const val UNCOMPRESSED_POINT_PREFIX: Byte = 0x04
  private const val HMAC = "HmacSHA256"
  private const val CIPHER = "AES/GCM/NoPadding"
  private val EMPTY = ByteArray(0)
  private val VERSION_LABEL = "HPKE-v1".toByteArray()
  private val KEM_SUITE_ID = "KEM".toByteArray() + bytesOf(KEM_ID)
  private val HPKE_SUITE_ID = "HPKE".toByteArray() + bytesOf(KEM_ID) + bytesOf(KDF_ID) + bytesOf(AEAD_ID)
  private val ZERO_SALT = ByteArray(HASH_BYTES)

  // Domain parameters of P-256 ✓ SEC 2, for the on-curve check of a received point.
  private val FIELD_PRIME = BigInteger("ffffffff00000001000000000000000000000000ffffffffffffffffffffffff", 16)
  private val COEFFICIENT_A = FIELD_PRIME - BigInteger.valueOf(3)
  private val COEFFICIENT_B = BigInteger("5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b", 16)
  private val parameters: ECParameterSpec = AlgorithmParameters.getInstance("EC")
    .apply { init(ECGenParameterSpec(ELLIPTIC_CURVE)) }
    .getParameterSpec(ECParameterSpec::class.java)

  /** Single-shot `Seal` ✓ RFC 9180 6.1; the ephemeral pair is a parameter only so a vector can drive it. */
  fun seal(
    plaintext: ByteArray,
    recipientPublicKey: ByteArray,
    info: ByteArray = EMPTY,
    aad: ByteArray = EMPTY,
    ephemeral: KeyPair = generateKeyPair(),
  ): Sealed {
    val recipient = deserializePublicKey(recipientPublicKey)
    val enc = serializePublicKey(ephemeral.public)
    val dh = KeyAgreement.getInstance("ECDH").apply {
      init(ephemeral.private)
      doPhase(recipient, true)
    }.generateSecret()
    val sharedSecret = extractAndExpand(dh, enc + serializePublicKey(recipient))
    val (key, baseNonce) = keySchedule(sharedSecret, info)
    val cipher = Cipher.getInstance(CIPHER)
    cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(TAG_BITS, baseNonce))
    cipher.updateAAD(aad)
    return Sealed(enc, cipher.doFinal(plaintext))
  }

  fun generateKeyPair(): KeyPair =
    KeyPairGenerator.getInstance("EC").apply { initialize(ECGenParameterSpec(ELLIPTIC_CURVE)) }.generateKeyPair()

  /** A pair from raw scalar and point, for the vectors of the RFC. */
  fun keyPairOf(scalar: ByteArray, point: ByteArray): KeyPair {
    val factory = KeyFactory.getInstance("EC")
    val privateKey: PrivateKey = factory.generatePrivate(ECPrivateKeySpec(BigInteger(1, scalar), parameters))
    return KeyPair(deserializePublicKey(point), privateKey)
  }

  /** `SerializePublicKey`: the uncompressed point of SEC 1 ✓ RFC 9180 7.1.1. */
  fun serializePublicKey(key: PublicKey): ByteArray {
    val point = (key as ECPublicKey).w
    return byteArrayOf(UNCOMPRESSED_POINT_PREFIX) + coordinate(point.affineX) + coordinate(point.affineY)
  }

  /** `DeserializePublicKey` with the on-curve check the JCA does not promise ✓ RFC 9180 7.1.1. */
  fun deserializePublicKey(point: ByteArray): PublicKey {
    if (point.size != POINT_BYTES || point[0] != UNCOMPRESSED_POINT_PREFIX) {
      throw InvalidRecipientKeyException()
    }
    val x = BigInteger(1, point.copyOfRange(1, 1 + COORDINATE_BYTES))
    val y = BigInteger(1, point.copyOfRange(1 + COORDINATE_BYTES, POINT_BYTES))
    if (x >= FIELD_PRIME || y >= FIELD_PRIME || !isOnCurve(x, y)) {
      throw InvalidRecipientKeyException()
    }
    return KeyFactory.getInstance("EC").generatePublic(ECPublicKeySpec(ECPoint(x, y), parameters))
  }

  private fun isOnCurve(x: BigInteger, y: BigInteger): Boolean {
    val left = y.multiply(y).mod(FIELD_PRIME)
    val right = x.pow(3).add(COEFFICIENT_A.multiply(x)).add(COEFFICIENT_B).mod(FIELD_PRIME)
    return left == right
  }

  private fun coordinate(value: BigInteger): ByteArray {
    val bytes = value.toByteArray()
    val start = maxOf(0, bytes.size - COORDINATE_BYTES)
    return ByteArray(COORDINATE_BYTES - (bytes.size - start)) + bytes.copyOfRange(start, bytes.size)
  }

  private fun extractAndExpand(dh: ByteArray, kemContext: ByteArray): ByteArray {
    val eaePrk = labeledExtract(KEM_SUITE_ID, ZERO_SALT, "eae_prk", dh)
    return labeledExpand(KEM_SUITE_ID, eaePrk, "shared_secret", kemContext, SHARED_SECRET_BYTES)
  }

  /** `KeySchedule` for the base mode ✓ RFC 9180 5.1. */
  private fun keySchedule(sharedSecret: ByteArray, info: ByteArray): Pair<ByteArray, ByteArray> {
    val pskIdHash = labeledExtract(HPKE_SUITE_ID, ZERO_SALT, "psk_id_hash", EMPTY)
    val infoHash = labeledExtract(HPKE_SUITE_ID, ZERO_SALT, "info_hash", info)
    val context = byteArrayOf(MODE_BASE) + pskIdHash + infoHash
    val secret = labeledExtract(HPKE_SUITE_ID, sharedSecret, "secret", EMPTY)
    return Pair(
      labeledExpand(HPKE_SUITE_ID, secret, "key", context, KEY_BYTES),
      labeledExpand(HPKE_SUITE_ID, secret, "base_nonce", context, NONCE_BYTES),
    )
  }

  /** `LabeledExtract` ✓ RFC 9180 4; HKDF-Extract is HMAC with the salt as key. */
  private fun labeledExtract(suiteId: ByteArray, salt: ByteArray, label: String, ikm: ByteArray): ByteArray =
    hmac(salt, VERSION_LABEL + suiteId + label.toByteArray() + ikm)

  /** `LabeledExpand` ✓ RFC 9180 4 over HKDF-Expand of RFC 5869. */
  private fun labeledExpand(suiteId: ByteArray, prk: ByteArray, label: String, info: ByteArray, length: Int): ByteArray {
    val labeledInfo = bytesOf(length) + VERSION_LABEL + suiteId + label.toByteArray() + info
    var output = EMPTY
    var previous = EMPTY
    var counter = 1
    while (output.size < length) {
      previous = hmac(prk, previous + labeledInfo + byteArrayOf(counter.toByte()))
      output += previous
      counter += 1
    }
    return output.copyOf(length)
  }

  private fun hmac(key: ByteArray, data: ByteArray): ByteArray =
    Mac.getInstance(HMAC).apply { init(SecretKeySpec(key, HMAC)) }.doFinal(data)

  private fun bytesOf(value: Int): ByteArray = byteArrayOf((value shr 8).toByte(), value.toByte())
}
