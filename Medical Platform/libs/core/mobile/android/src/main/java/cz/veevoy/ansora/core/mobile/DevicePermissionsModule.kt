package cz.veevoy.ansora.core.mobile

import android.Manifest
import android.content.pm.PackageManager
import expo.modules.interfaces.permissions.Permissions
import expo.modules.interfaces.permissions.PermissionsResponse
import expo.modules.interfaces.permissions.PermissionsStatus
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val GRANTED = "granted"
private const val DENIED = "denied"

class DevicePermissionsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DevicePermissions")

    AsyncFunction("requestCapture") { promise: Promise ->
      askForCamera(promise)
    }
  }

  private fun askForCamera(promise: Promise) {
    val permissions = appContext.permissions ?: throw Exceptions.PermissionsModuleNotFound()
    permissions.askForPermissions({ response ->
      promise.resolve(mapOf("camera" to decisionOf(response), "nfc" to nfcDecision()))
    }, Manifest.permission.CAMERA)
  }

  private fun decisionOf(response: Map<String, PermissionsResponse>): String {
    val camera = response[Manifest.permission.CAMERA] ?: return DENIED
    return if (camera.status == PermissionsStatus.GRANTED) GRANTED else DENIED
  }

  // NFC needs no runtime prompt; the device either has the radio or it does not.
  private fun nfcDecision(): String {
    val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
    return if (context.packageManager.hasSystemFeature(PackageManager.FEATURE_NFC)) GRANTED else DENIED
  }
}
