package cz.veevoy.ansora.core.mobile

import android.os.Build
import java.time.Instant
import java.time.format.DateTimeParseException

// CAP-002-R09
private const val RENEWAL_MARGIN_MS = 60_000L

// CAP-002-R09, CAP-019-S05
internal class DeviceTokenCache(private val nowMs: () -> Long) {
  private var token: String? = null
  private var expiresAtMs = 0L

  @Synchronized
  fun valid(): String? = token?.takeIf { expiresAtMs - RENEWAL_MARGIN_MS > nowMs() }

  @Synchronized
  fun remember(value: String, expiresAtMs: Long) {
    token = value
    this.expiresAtMs = expiresAtMs
  }

  @Synchronized
  fun forget(value: String) {
    if (token == value) {
      token = null
    }
  }

  // CAP-007-R04
  @Synchronized
  fun clear() {
    token = null
    expiresAtMs = 0L
  }
}

internal object DeviceTokens {
  val cache = DeviceTokenCache(System::currentTimeMillis)

  val issuing = Any()
}

internal fun expiryMsOf(text: String?): Long? {
  if (text == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
    return null
  }
  return try {
    Instant.parse(text).toEpochMilli()
  } catch (failure: DateTimeParseException) {
    null
  }
}
