package cz.veevoy.ansora.core.mobile

import java.util.Base64
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

private val URL_ENCODER = Base64.getUrlEncoder().withoutPadding()

class DeviceProofsTest {
  @Test
  fun proofUriDropsQueryAndFragment() {
    val url = "https://vulna.example:8443/api/v1/acquisitions/a/files?x=1#part".toHttpUrl()

    assertEquals("https://vulna.example:8443/api/v1/acquisitions/a/files", proofUriOf(url))
  }

  @Test
  fun proofUriKeepsDefaultPortOut() {
    assertEquals("https://vulna.example/api/v1/device/verification", proofUriOf("https://vulna.example:443/api/v1/device/verification".toHttpUrl()))
  }

  @Test
  fun claimsBindMethodAddressTimeAndToken() {
    val input = ProofInput("post", "https://vulna.example/api/v1/x?y=1".toHttpUrl(), "token", "nonce-1")

    val claims = proofClaimsOf(input, "jti-1", 1_760_000_000L) { "hash-of-$it" }

    assertEquals(
      mapOf(
        "jti" to "jti-1",
        "htm" to "POST",
        "htu" to "https://vulna.example/api/v1/x",
        "iat" to 1_760_000_000L,
        "nonce" to "nonce-1",
        "ath" to "hash-of-token",
      ),
      claims,
    )
  }

  @Test
  fun claimsWithoutTokenOrNonceLeaveThemOut() {
    val claims = proofClaimsOf(ProofInput("POST", "https://vulna.example/".toHttpUrl(), null, null), "j", 1L) { it }

    assertFalse("ath" in claims)
    assertFalse("nonce" in claims)
  }

  @Test
  fun accessTokenHashIsBase64UrlOfSha256() {
    assertEquals(
      "47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU",
      accessTokenHashOf("", URL_ENCODER::encodeToString),
    )
  }
}
