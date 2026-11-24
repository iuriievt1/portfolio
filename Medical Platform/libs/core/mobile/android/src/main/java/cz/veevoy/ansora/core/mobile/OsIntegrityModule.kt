package cz.veevoy.ansora.core.mobile

import android.content.Context
import android.util.Log
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val DETECTED_EVENT = "detected"
private const val SIGNALS = "signals"
internal const val OS_INTEGRITY_LOG_TAG = "OsIntegrity"

// mobilni-aplikace.md 2, NAB-144, NAB-454
class OsIntegrityModule : Module() {
  private val evidence by lazy { DeviceIntegrityEvidence(context()) }
  private val monitorHolder = lazy {
    IntegrityMonitor(
      detect = ::detect,
      report = { signals -> sendEvent(DETECTED_EVENT, mapOf(SIGNALS to wireOf(signals))) },
      warn = { failure -> Log.w(OS_INTEGRITY_LOG_TAG, "The integrity of the device could not be checked", failure) },
    )
  }
  private val monitor by monitorHolder

  override fun definition() = ModuleDefinition {
    Name("OsIntegrity")

    Events(DETECTED_EVENT)

    // CAP-008-R01, CAP-008-R10
    AsyncFunction("detect") {
      wireOf(detect())
    }

    // CAP-008-R01, CAP-008-S02
    OnStartObserving {
      monitor.observe(true)
    }

    OnStopObserving {
      monitor.observe(false)
    }

    OnActivityEntersForeground {
      monitor.enterForeground()
    }

    OnActivityEntersBackground {
      monitor.enterBackground()
    }

    OnDestroy {
      if (monitorHolder.isInitialized()) {
        monitor.close()
      }
    }
  }

  private fun context(): Context = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private fun detect(): List<IntegritySignal> = IntegrityDetection.detect(evidence, POLICY)

  private fun wireOf(signals: List<IntegritySignal>): List<String> = signals.map { it.wire }

  private companion object {
    // CAP-008-S06
    val POLICY = IntegrityPolicy(
      isDevelopmentBuild = BuildConfig.DEBUG,
      expectedSignerDigests = IntegrityDetection.signerDigestsOf(BuildConfig.RELEASE_SIGNER_SHA256),
    )
  }
}
