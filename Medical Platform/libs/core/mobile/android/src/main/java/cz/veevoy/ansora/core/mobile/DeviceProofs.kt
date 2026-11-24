package cz.veevoy.ansora.core.mobile

import android.util.Base64
import java.security.MessageDigest
import java.security.SecureRandom
import okhttp3.HttpUrl
import org.json.JSONObject

private const val DPOP_TYPE = "dpop+jwt"
private const val JWS_ALGORITHM = "ES256"
private const val JTI_BYTES = 16
private const val DIGEST_ALGORITHM = "SHA-256"
private const val MILLISECONDS_PER_SECOND = 1_000L
private const val BASE64_URL = Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING

internal data class ProofInput(
  val method: String,
  val url: HttpUrl,
  val accessToken: String?,
  val nonce: String?,
)

// RFC 9449 4.2
internal fun proofUriOf(url: HttpUrl): String = url.newBuilder().query(null).fragment(null).build().toString()

// RFC 9449 4.2, ADR-013, Q-082
internal fun proofClaimsOf(
  input: ProofInput,
  jti: String,
  issuedAtSeconds: Long,
  accessTokenHashOf: (String) -> String,
): Map<String, Any> {
  val claims = linkedMapOf<String, Any>(
    "jti" to jti,
    "htm" to input.method.uppercase(),
    "htu" to proofUriOf(input.url),
    "iat" to issuedAtSeconds,
  )
  input.nonce?.let { claims["nonce"] = it }
  input.accessToken?.let { claims["ath"] = accessTokenHashOf(it) }
  return claims
}

// RFC 9449 6.1
internal fun accessTokenHashOf(token: String, encode: (ByteArray) -> String): String =
  encode(MessageDigest.getInstance(DIGEST_ALGORITHM).digest(token.toByteArray(Charsets.US_ASCII)))

// RFC 9449, ADR-013, Q-082, NAB-143
internal class DeviceProofs(private val deviceKey: DeviceKey) {
  private val random = SecureRandom()

  fun of(input: ProofInput): String {
    val header = JSONObject()
      .put("typ", DPOP_TYPE)
      .put("alg", JWS_ALGORITHM)
      .put("jwk", JSONObject(deviceKey.info().publicKeyJwk))
    val claims = proofClaimsOf(input, randomIdentifier(), nowSeconds()) { accessTokenHashOf(it, ::base64Url) }
    return deviceKey.signJws(header.toString(), JSONObject(claims).toString())
  }

  private fun randomIdentifier(): String = base64Url(ByteArray(JTI_BYTES).also { random.nextBytes(it) })

  private fun nowSeconds(): Long = System.currentTimeMillis() / MILLISECONDS_PER_SECOND

  private fun base64Url(bytes: ByteArray): String = Base64.encodeToString(bytes, BASE64_URL)
}

// RFC 9449 8
internal object ProofNonce {
  @Volatile var latest: String? = null
}
