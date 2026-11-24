package cz.veevoy.ansora.core.mobile

import android.app.Application
import android.content.Context
import com.facebook.react.modules.network.OkHttpClientFactory
import com.facebook.react.modules.network.OkHttpClientProvider
import expo.modules.core.interfaces.ApplicationLifecycleListener
import expo.modules.core.interfaces.Package

/**
 * Every OkHttp client React Native hands out is pinned before the first request: Expo's `fetch`,
 * which is the global `fetch` since SDK 54, and React Native's own networking take their client
 * from the same provider ✓ CAP-010-R04, CAP-010-R05, CAP-010-R14.
 */
class NetworkPinningPackage : Package {
  override fun createApplicationLifecycleListeners(context: Context): List<ApplicationLifecycleListener> =
    listOf(PinnedClientInstaller)
}

internal object PinnedClientInstaller : ApplicationLifecycleListener {
  override fun onCreate(application: Application) {
    PinStore.load(PinFile(application))
    OkHttpClientProvider.setOkHttpClientFactory(
      OkHttpClientFactory {
        OkHttpClientProvider.createClientBuilder(application).also { PinnedClientBuilder.apply(it) }.build()
      },
    )
  }
}
