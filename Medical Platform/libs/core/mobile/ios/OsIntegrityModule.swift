import ExpoModulesCore
import UIKit

private let detectedEvent = "detected"
private let signalsKey = "signals"

// mobilni-aplikace.md 2, NAB-144, NAB-454
public final class OsIntegrityModule: Module {
  // CAP-008-S06
  private static let policy: IntegrityPolicy = {
    #if DEBUG
    return IntegrityPolicy(isDevelopmentBuild: true)
    #else
    return IntegrityPolicy(isDevelopmentBuild: false)
    #endif
  }()

  private var monitor: IntegrityMonitor?

  public func definition() -> ModuleDefinition {
    Name("OsIntegrity")

    Events(detectedEvent)

    OnCreate { [weak self] in
      self?.createMonitor()
    }

    // CAP-008-R01, CAP-008-R10
    AsyncFunction("detect") { () -> [String] in
      Self.detect().map(\.rawValue)
    }

    // CAP-008-R01, CAP-008-S02
    OnStartObserving { [weak self] in
      self?.monitor?.observe(true)
    }

    OnStopObserving { [weak self] in
      self?.monitor?.observe(false)
    }

    OnAppEntersForeground { [weak self] in
      self?.monitor?.enterForeground()
    }

    OnAppEntersBackground { [weak self] in
      self?.monitor?.enterBackground()
    }
  }

  private func createMonitor() {
    let monitor = IntegrityMonitor(
      detect: Self.detect,
      report: { [weak self] signals in
        self?.sendEvent(detectedEvent, [signalsKey: signals.map(\.rawValue)])
      }
    )
    self.monitor = monitor
    DispatchQueue.main.async { [weak monitor] in
      guard UIApplication.shared.applicationState != .background else {
        return
      }
      monitor?.enterForeground()
    }
  }

  private static func detect() -> [IntegritySignal] {
    IntegrityDetection.detect(DeviceIntegrityEvidence(), policy: policy)
  }
}
