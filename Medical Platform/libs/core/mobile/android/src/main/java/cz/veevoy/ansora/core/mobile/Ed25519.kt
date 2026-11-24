package cz.veevoy.ansora.core.mobile

import java.math.BigInteger
import java.security.KeyFactory
import java.security.MessageDigest
import java.security.PrivateKey
import java.security.spec.PKCS8EncodedKeySpec

internal object Ed25519 {
  private const val ALGORITHM = "Ed25519"
  private const val SHA_512 = "SHA-512"
  const val SEED_BYTES = 32
  const val SIGN_BIT = 0x80
  private const val LAST_BYTE = SEED_BYTES - 1
  private const val CLAMP_LOW = 0xf8
  private const val CLAMP_HIGH = 0x3f
  private const val HIGH_BIT = 0x40

  private val PRIME: BigInteger = BigInteger.TWO.pow(255).subtract(BigInteger.valueOf(19))
  private val D: BigInteger = BigInteger.valueOf(-121_665).multiply(BigInteger.valueOf(121_666).modInverse(PRIME)).mod(PRIME)
  private val BASE = Point(
    BigInteger("15112221349535400772501151409588531511454012693041857206046113283949847762202"),
    BigInteger("46316835694926478169428394003475163141307993866256225615783033603165251855960"),
  )

  // RFC 8410
  private val PKCS8_PREFIX = byteArrayOf(0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20)

  fun privateKey(seed: ByteArray): PrivateKey {
    require(seed.size == SEED_BYTES)
    val encoded = PKCS8_PREFIX + seed
    try {
      return KeyFactory.getInstance(ALGORITHM).generatePrivate(PKCS8EncodedKeySpec(encoded))
    } finally {
      encoded.fill(0)
    }
  }

  fun publicKeyBytes(seed: ByteArray): ByteArray {
    require(seed.size == SEED_BYTES)
    val digest = MessageDigest.getInstance(SHA_512).digest(seed)
    val scalarBytes = digest.copyOf(SEED_BYTES)
    scalarBytes[0] = (scalarBytes[0].toInt() and CLAMP_LOW).toByte()
    scalarBytes[LAST_BYTE] = ((scalarBytes[LAST_BYTE].toInt() and CLAMP_HIGH) or HIGH_BIT).toByte()
    val scalar = BigInteger(1, scalarBytes.reversedArray())
    return multiply(scalar, BASE).encoded()
  }

  private class Point(val x: BigInteger, val y: BigInteger, val z: BigInteger = BigInteger.ONE, val t: BigInteger = x.multiply(y).mod(PRIME)) {
    operator fun plus(other: Point): Point {
      val a = y.subtract(x).multiply(other.y.subtract(other.x)).mod(PRIME)
      val b = y.add(x).multiply(other.y.add(other.x)).mod(PRIME)
      val c = t.multiply(BigInteger.TWO).multiply(D).multiply(other.t).mod(PRIME)
      val d = z.multiply(BigInteger.TWO).multiply(other.z).mod(PRIME)
      val e = b.subtract(a)
      val f = d.subtract(c)
      val g = d.add(c)
      val h = b.add(a)
      return Point(e.multiply(f).mod(PRIME), g.multiply(h).mod(PRIME), f.multiply(g).mod(PRIME), e.multiply(h).mod(PRIME))
    }

    fun encoded(): ByteArray {
      val inverse = z.modInverse(PRIME)
      val affineX = x.multiply(inverse).mod(PRIME)
      val affineY = y.multiply(inverse).mod(PRIME)
      val out = ByteArray(SEED_BYTES)
      val yBytes = affineY.toByteArray().reversedArray()
      yBytes.copyInto(out, 0, 0, minOf(yBytes.size, SEED_BYTES))
      if (affineX.testBit(0)) {
        out[LAST_BYTE] = (out[LAST_BYTE].toInt() or SIGN_BIT).toByte()
      }
      return out
    }
  }

  private val IDENTITY = Point(BigInteger.ZERO, BigInteger.ONE)

  private fun multiply(scalar: BigInteger, point: Point): Point {
    var result = IDENTITY
    var addend = point
    for (bit in 0 until scalar.bitLength()) {
      if (scalar.testBit(bit)) {
        result += addend
      }
      addend += addend
    }
    return result
  }
}
