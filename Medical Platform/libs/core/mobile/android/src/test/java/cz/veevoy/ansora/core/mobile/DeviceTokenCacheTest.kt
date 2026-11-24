package cz.veevoy.ansora.core.mobile

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class DeviceTokenCacheTest {
  private var now = 1_000_000L
  private val cache = DeviceTokenCache { now }

  @Test
  fun holdsTheTokenUntilAMinuteBeforeExpiry() {
    cache.remember("token", now + 15 * 60_000L)

    now += 13 * 60_000L
    assertEquals("token", cache.valid())

    now += 60_000L
    assertNull(cache.valid())
  }

  @Test
  fun forgetsOnlyTheRejectedToken() {
    cache.remember("newer", now + 15 * 60_000L)

    cache.forget("older")
    assertEquals("newer", cache.valid())

    cache.forget("newer")
    assertNull(cache.valid())
  }

  @Test
  fun startsEmpty() {
    assertNull(cache.valid())
  }
}
