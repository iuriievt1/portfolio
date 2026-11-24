package cz.veevoy.ansora.core.mobile

import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit

// CAP-008-R01, CAP-008-S02
class IntegrityMonitor(
  private val detect: () -> List<IntegritySignal>,
  private val report: (List<IntegritySignal>) -> Unit,
  private val warn: (Exception) -> Unit,
  private val intervalMilliseconds: Long = INTERVAL_MILLISECONDS,
) {
  private val executor = Executors.newSingleThreadScheduledExecutor()
  private var periodic: ScheduledFuture<*>? = null
  private var isObserved = false
  private var isForeground = true

  @Synchronized
  fun observe(observed: Boolean) {
    isObserved = observed
    reschedule()
  }

  @Synchronized
  fun enterForeground() {
    isForeground = true
    reschedule()
  }

  @Synchronized
  fun enterBackground() {
    isForeground = false
    reschedule()
  }

  @Synchronized
  fun close() {
    periodic?.cancel(false)
    periodic = null
    executor.shutdownNow()
  }

  private fun reschedule() {
    periodic?.cancel(false)
    periodic = null
    if (isObserved && isForeground && !executor.isShutdown) {
      periodic = executor.scheduleWithFixedDelay(::check, NO_DELAY, intervalMilliseconds, TimeUnit.MILLISECONDS)
    }
  }

  private fun check() {
    try {
      val signals = detect()
      if (signals.isNotEmpty()) {
        report(signals)
      }
    } catch (failure: Exception) {
      warn(failure)
    }
  }

  companion object {
    const val INTERVAL_MILLISECONDS = 30_000L
    private const val NO_DELAY = 0L
  }
}
