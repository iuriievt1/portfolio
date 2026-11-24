package cz.veevoy.ansora.core.mobile

import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

// CAP-008-R01, CAP-008-S02
class IntegrityMonitorTest {
  private class Probe(signals: List<IntegritySignal> = emptyList(), private val failing: Boolean = false) {
    val checks = AtomicInteger()
    val reports = mutableListOf<List<IntegritySignal>>()
    val warnings = AtomicInteger()
    var checked = CountDownLatch(1)
    var reported = CountDownLatch(1)
    private val found = signals

    fun detect(): List<IntegritySignal> {
      checks.incrementAndGet()
      checked.countDown()
      if (failing) {
        throw IllegalStateException("probe failed")
      }
      return found
    }

    @Synchronized
    fun report(signals: List<IntegritySignal>) {
      reports.add(signals)
      reported.countDown()
    }
  }

  private fun monitorOf(probe: Probe, intervalMilliseconds: Long = SHORT_INTERVAL) =
    IntegrityMonitor(probe::detect, probe::report, { probe.warnings.incrementAndGet() }, intervalMilliseconds)

  @Test
  fun `CAP-008-S02 reports a debugger attached while the app is open`() {
    val probe = Probe(listOf(IntegritySignal.DEBUGGER))
    val monitor = monitorOf(probe)

    monitor.observe(true)

    assertTrue(probe.reported.await(WAIT_SECONDS, TimeUnit.SECONDS))
    assertEquals(listOf(IntegritySignal.DEBUGGER), probe.reports.first())
    monitor.close()
  }

  @Test
  fun `CAP-008-R01 keeps checking while the app is open`() {
    val probe = Probe()
    probe.checked = CountDownLatch(3)
    val monitor = monitorOf(probe)

    monitor.observe(true)

    assertTrue(probe.checked.await(WAIT_SECONDS, TimeUnit.SECONDS))
    assertEquals(emptyList<List<IntegritySignal>>(), probe.reports)
    monitor.close()
  }

  @Test
  fun `checks nothing until the app listens`() {
    val probe = Probe()
    val monitor = monitorOf(probe)

    Thread.sleep(SETTLE_MILLISECONDS)

    assertEquals(0, probe.checks.get())
    monitor.close()
  }

  @Test
  fun `CAP-008-R01 rests in the background and checks at once on return`() {
    val probe = Probe()
    val monitor = monitorOf(probe, LONG_INTERVAL)
    monitor.observe(true)
    assertTrue(probe.checked.await(WAIT_SECONDS, TimeUnit.SECONDS))

    monitor.enterBackground()
    Thread.sleep(SETTLE_MILLISECONDS)
    val inBackground = probe.checks.get()
    probe.checked = CountDownLatch(1)
    monitor.enterForeground()

    assertEquals(1, inBackground)
    assertTrue(probe.checked.await(WAIT_SECONDS, TimeUnit.SECONDS))
    assertEquals(2, probe.checks.get())
    monitor.close()
  }

  @Test
  fun `keeps checking after a check failed`() {
    val probe = Probe(failing = true)
    probe.checked = CountDownLatch(2)
    val monitor = monitorOf(probe)

    monitor.observe(true)

    assertTrue(probe.checked.await(WAIT_SECONDS, TimeUnit.SECONDS))
    assertTrue(probe.warnings.get() >= 1)
    monitor.close()
  }

  @Test
  fun `stops when the app stops listening`() {
    val probe = Probe()
    val monitor = monitorOf(probe, LONG_INTERVAL)
    monitor.observe(true)
    assertTrue(probe.checked.await(WAIT_SECONDS, TimeUnit.SECONDS))

    monitor.observe(false)
    monitor.enterBackground()
    monitor.enterForeground()
    Thread.sleep(SETTLE_MILLISECONDS)

    assertEquals(1, probe.checks.get())
    monitor.close()
  }

  private companion object {
    const val SHORT_INTERVAL = 10L
    const val LONG_INTERVAL = 60_000L
    const val SETTLE_MILLISECONDS = 100L
    const val WAIT_SECONDS = 5L
  }
}
