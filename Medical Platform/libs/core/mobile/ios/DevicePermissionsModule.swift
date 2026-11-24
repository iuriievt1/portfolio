import AVFoundation
import CoreNFC
import ExpoModulesCore

private let granted = "granted"
private let denied = "denied"

public final class DevicePermissionsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DevicePermissions")

    AsyncFunction("requestCapture") { (promise: Promise) in
      AVCaptureDevice.requestAccess(for: .video) { allowed in
        promise.resolve([
          "camera": allowed ? granted : denied,
          "nfc": NFCNDEFReaderSession.readingAvailable ? granted : denied,
        ])
      }
    }
  }
}
