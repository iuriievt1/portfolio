package cz.veevoy.ansora.core.mobile

import android.app.Activity
import android.os.Build
import android.view.WindowManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ScreenPrivacyModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ScreenPrivacy")

    OnActivityEntersForeground {
      appContext.currentActivity?.let(::hideContentFromRecents)
    }

    // CAP-013-R04
    Function("allowSystemSheet") { _: Boolean -> }
  }

  private fun hideContentFromRecents(activity: Activity) {
    activity.runOnUiThread {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        activity.setRecentsScreenshotEnabled(false)
      } else {
        activity.window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
      }
    }
  }
}
