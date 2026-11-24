package cz.veevoy.ansora.core.mobile

import java.util.concurrent.TimeUnit
import javax.net.ssl.SSLPeerUnverifiedException
import okhttp3.Call
import okhttp3.Connection
import okhttp3.Interceptor
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

private const val PINNED_HOST = "pinned.example"
private const val PRIMARY_FINGERPRINT = "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
private const val BACKUP_FINGERPRINT = "sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB="
private const val OK = 200
private const val UNPINNED_HOST = "unpinned.example"

private class MemoryPins : PinStorage {
  var kept: Map<String, Set<String>> = emptyMap()

  override fun load(): Map<String, Set<String>> = kept

  override fun save(pinsByHost: Map<String, Set<String>>) {
    kept = pinsByHost
  }
}

private class ChainWithoutConnection(private val request: Request) : Interceptor.Chain {
  var proceeded = false

  override fun request(): Request = request

  override fun proceed(request: Request): Response {
    proceeded = true
    return Response.Builder().request(request).protocol(Protocol.HTTP_1_1).code(OK).message("OK").build()
  }

  override fun connection(): Connection? = null

  override fun call(): Call = throw UnsupportedOperationException()

  override fun connectTimeoutMillis(): Int = 0

  override fun withConnectTimeout(timeout: Int, unit: TimeUnit): Interceptor.Chain = this

  override fun readTimeoutMillis(): Int = 0

  override fun withReadTimeout(timeout: Int, unit: TimeUnit): Interceptor.Chain = this

  override fun writeTimeoutMillis(): Int = 0

  override fun withWriteTimeout(timeout: Int, unit: TimeUnit): Interceptor.Chain = this
}

class SpkiPinningInterceptorTest {
  private val interceptor = SpkiPinningInterceptor(requiresPins = false)
  private val requiringInterceptor = SpkiPinningInterceptor(requiresPins = true)
  private val storage = MemoryPins()

  init {
    PinStore.load(storage)
    PinStore.replace(PINNED_HOST, listOf(PRIMARY_FINGERPRINT, BACKUP_FINGERPRINT))
  }

  @Test
  fun `lets a cleartext request to a pinned host through`() {
    val chain = ChainWithoutConnection(Request.Builder().url("http://$PINNED_HOST:9000/discovery").build())

    assertEquals(OK, interceptor.intercept(chain).code)
    assertEquals(true, chain.proceeded)
  }

  @Test
  fun `refuses a TLS request to a pinned host without a handshake`() {
    val chain = ChainWithoutConnection(Request.Builder().url("https://$PINNED_HOST/api").build())

    assertThrows(SSLPeerUnverifiedException::class.java) { interceptor.intercept(chain) }
    assertEquals(false, chain.proceeded)
  }

  @Test
  fun `lets a TLS request to a host without pins through in the foreground`() {
    val chain = ChainWithoutConnection(Request.Builder().url("https://$UNPINNED_HOST/idp").build())

    assertEquals(OK, interceptor.intercept(chain).code)
  }

  // CAP-010-R08
  @Test
  fun `refuses a background TLS request to a host without pins`() {
    val chain = ChainWithoutConnection(Request.Builder().url("https://$UNPINNED_HOST/api").build())

    assertThrows(SSLPeerUnverifiedException::class.java) { requiringInterceptor.intercept(chain) }
    assertEquals(false, chain.proceeded)
  }

  // CAP-010-R08
  @Test
  fun `keeps the pins for a process that starts without JavaScript`() {
    PinStore.load(MemoryPins())
    PinStore.load(storage)

    assertEquals(setOf(PRIMARY_FINGERPRINT, BACKUP_FINGERPRINT), PinStore.pins(PINNED_HOST))
  }
}
