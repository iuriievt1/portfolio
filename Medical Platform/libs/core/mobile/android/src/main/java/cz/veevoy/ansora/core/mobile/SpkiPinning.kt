package cz.veevoy.ansora.core.mobile

import android.content.Context
import android.util.Base64
import expo.modules.kotlin.exception.CodedException
import java.io.File
import java.io.IOException
import java.security.MessageDigest
import java.security.cert.X509Certificate
import java.util.concurrent.atomic.AtomicReference
import javax.net.ssl.SSLPeerUnverifiedException
import okhttp3.Interceptor
import okhttp3.Response
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

private const val FINGERPRINT_PREFIX = "sha256/"
internal const val SHA_256 = "SHA-256"
private const val MINIMUM_FINGERPRINTS = 2
private val FINGERPRINT = Regex("^sha256/[A-Za-z0-9+/]{43}=$")
internal const val PINS_FILE_NAME = "pins.json"

class InvalidFingerprintException(fingerprint: String) :
  CodedException(
    "pinning-fingerprint-invalid",
    "The fingerprint $fingerprint is not sha256/ followed by a base64 SHA-256 of the SPKI",
    null,
  )

class TooFewFingerprintsException(count: Int) :
  CodedException("pinning-fingerprints-too-few", "Pinning needs a primary and a backup fingerprint, got $count", null)

class EmptyHostException :
  CodedException("pinning-host-empty", "The pinned host is empty", null)

class PinsNotPersistedException :
  CodedException("pinning-pins-not-persisted", "The pins could not be kept for the background upload", null)

/** Fingerprints per host ✓ CAP-010-R06; read on the network threads, replaced from JavaScript ✓ CAP-010-R07. */
internal object PinStore {
  private val pinsByHost = AtomicReference<Map<String, Set<String>>>(emptyMap())
  @Volatile private var storage: PinStorage? = null

  // CAP-010-R08
  fun load(from: PinStorage) {
    storage = from
    pinsByHost.set(from.load())
  }

  fun loadIfAbsent(from: PinStorage) {
    synchronized(this) {
      if (storage == null) {
        load(from)
      }
    }
  }

  fun replace(host: String, fingerprints: List<String>) {
    val key = host.trim().lowercase()
    if (key.isEmpty()) {
      throw EmptyHostException()
    }
    val pins = validated(fingerprints)
    val kept = storage ?: throw PinsNotPersistedException()
    synchronized(this) {
      val next = pinsByHost.get() + (key to pins)
      try {
        kept.save(next)
      } catch (failure: IOException) {
        throw PinsNotPersistedException()
      }
      pinsByHost.set(next)
    }
  }

  fun pins(host: String): Set<String>? = pinsByHost.get()[host.lowercase()]

  fun validated(fingerprints: List<String>): Set<String> {
    val pins = fingerprints.toSet()
    pins.firstOrNull { !FINGERPRINT.matches(it) }?.let { throw InvalidFingerprintException(it) }
    if (pins.size < MINIMUM_FINGERPRINTS) {
      throw TooFewFingerprintsException(pins.size)
    }
    return pins
  }
}

internal interface PinStorage {
  fun load(): Map<String, Set<String>>

  fun save(pinsByHost: Map<String, Set<String>>)
}

// CAP-019-R09
internal class PinFile(context: Context) : PinStorage {
  private val context = context.applicationContext

  override fun load(): Map<String, Set<String>> {
    val source = file()
    if (!source.isFile) {
      return emptyMap()
    }
    val stored = try {
      JSONObject(source.readText())
    } catch (failure: JSONException) {
      return emptyMap()
    } catch (failure: IOException) {
      return emptyMap()
    }
    return stored.keys().asSequence().mapNotNull { host ->
      val fingerprints = stored.optJSONArray(host) ?: return@mapNotNull null
      val pins = runCatching { PinStore.validated(List(fingerprints.length()) { fingerprints.optString(it) }) }
      pins.getOrNull()?.let { host to it }
    }.toMap()
  }

  override fun save(pinsByHost: Map<String, Set<String>>) {
    val json = JSONObject()
    for ((host, pins) in pinsByHost) {
      json.put(host, JSONArray(pins.sorted()))
    }
    writeAtomically(file(), json.toString())
  }

  private fun file(): File = File(VaultLayout.root(context), PINS_FILE_NAME)
}

internal object SpkiPinning {
  /** SHA-256 of the DER SubjectPublicKeyInfo in base64, prefixed with the algorithm as in RFC 7469. */
  fun fingerprint(certificate: X509Certificate): String {
    val digest = MessageDigest.getInstance(SHA_256).digest(certificate.publicKey.encoded)
    return FINGERPRINT_PREFIX + Base64.encodeToString(digest, Base64.NO_WRAP)
  }
}

/**
 * Runs after the system validated the chain and the host name and before any request bytes leave
 * the device; the pin then decides ✓ CAP-010-R05, CAP-010-R06.
 */
internal class SpkiPinningInterceptor(private val requiresPins: Boolean) : Interceptor {
  override fun intercept(chain: Interceptor.Chain): Response {
    val request = chain.request()
    if (!request.isHttps) {
      return chain.proceed(request)
    }
    val host = request.url.host
    val pins = PinStore.pins(host)
      ?: if (requiresPins) throw SSLPeerUnverifiedException("No pins for $host") else return chain.proceed(request)
    val handshake = chain.connection()?.handshake()
      ?: throw SSLPeerUnverifiedException("No TLS handshake with the pinned host $host")
    val leaf = handshake.peerCertificates.firstOrNull() as? X509Certificate
      ?: throw SSLPeerUnverifiedException("No server certificate from the pinned host $host")
    if (SpkiPinning.fingerprint(leaf) !in pins) {
      throw SSLPeerUnverifiedException("The public key of $host matches none of the pinned fingerprints")
    }
    return chain.proceed(request)
  }
}
