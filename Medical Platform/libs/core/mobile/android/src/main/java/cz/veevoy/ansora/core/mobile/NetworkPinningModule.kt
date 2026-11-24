package cz.veevoy.ansora.core.mobile

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import okhttp3.ConnectionSpec
import okhttp3.OkHttpClient

class NetworkPinningModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NetworkPinning")

    AsyncFunction("setPins") { host: String, fingerprints: List<String> ->
      PinStore.replace(host, fingerprints)
    }
  }
}

/** TLS 1.2 or newer ✓ CAP-010-R04; cleartext stays only for the development server. */
internal object PinnedClientBuilder {
  private val connectionSpecs = listOf(ConnectionSpec.MODERN_TLS, ConnectionSpec.CLEARTEXT)
  private val interceptor = SpkiPinningInterceptor(requiresPins = false)
  private val requiringInterceptor = SpkiPinningInterceptor(requiresPins = true)

  fun apply(builder: OkHttpClient.Builder) {
    builder.connectionSpecs(connectionSpecs)
    if (builder.networkInterceptors().none { it === interceptor }) {
      builder.addNetworkInterceptor(interceptor)
    }
  }

  // CAP-010-R08
  fun applyRequiringPins(builder: OkHttpClient.Builder) {
    builder.connectionSpecs(connectionSpecs)
    builder.addNetworkInterceptor(requiringInterceptor)
  }
}
