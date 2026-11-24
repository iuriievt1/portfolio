package cz.veevoy.ansora.core.mobile

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.RestrictionsManager
import android.os.Bundle
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val CHANGED_EVENT = "changed"

/**
 * Managed configuration of Android Enterprise ✓ NAB-483. The system announces a change and the app
 * reads the restrictions again; it counts from the next connection ✓ CAP-010-R07.
 */
class ManagedConfigurationModule : Module() {
  private val receiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      sendEvent(CHANGED_EVENT)
    }
  }

  override fun definition() = ModuleDefinition {
    Name("ManagedConfiguration")

    Events(CHANGED_EVENT)

    AsyncFunction("read") {
      readApplicationRestrictions()
    }

    // A system broadcast wants an exported receiver; the action is protected, so only the system
    // sends it, and the receiver does nothing but tell JavaScript to read the restrictions again.
    OnStartObserving {
      ContextCompat.registerReceiver(
        context(),
        receiver,
        IntentFilter(Intent.ACTION_APPLICATION_RESTRICTIONS_CHANGED),
        ContextCompat.RECEIVER_EXPORTED,
      )
    }

    OnStopObserving {
      context().unregisterReceiver(receiver)
    }
  }

  private fun context(): Context = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private fun readApplicationRestrictions(): Bundle {
    val restrictionsManager = context().getSystemService(RestrictionsManager::class.java)
    return restrictionsManager?.applicationRestrictions ?: Bundle()
  }
}
