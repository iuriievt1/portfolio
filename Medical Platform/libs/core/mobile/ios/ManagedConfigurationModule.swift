import ExpoModulesCore

private let managedConfigurationKey = "com.apple.configuration.managed"
private let changedEvent = "changed"

/// Managed App Configuration ✓ NAB-485. The MDM writes into the standard defaults; a change
/// counts from the next connection ✓ CAP-010-R07, `docs/spec/konfigurace-a-profily.md` kap. 2.2.
public final class ManagedConfigurationModule: Module {
  private let lock = NSLock()
  private var lastSeen: NSDictionary?
  private var observer: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("ManagedConfiguration")

    Events(changedEvent)

    AsyncFunction("read") { () -> [String: Any] in
      let configuration = self.current()
      self.remember(configuration)
      return configuration
    }

    OnStartObserving { [weak self] in
      self?.startObserving()
    }

    OnStopObserving { [weak self] in
      self?.stopObserving()
    }
  }

  private func startObserving() {
    notifyIfChanged()
    observer = NotificationCenter.default.addObserver(
      forName: UserDefaults.didChangeNotification,
      object: nil,
      queue: nil
    ) { [weak self] _ in
      self?.notifyIfChanged()
    }
  }

  private func stopObserving() {
    guard let observer else {
      return
    }
    NotificationCenter.default.removeObserver(observer)
    self.observer = nil
  }

  private func current() -> [String: Any] {
    UserDefaults.standard.dictionary(forKey: managedConfigurationKey) ?? [:]
  }

  private func remember(_ configuration: [String: Any]) {
    lock.lock()
    defer { lock.unlock() }
    lastSeen = configuration as NSDictionary
  }

  /// The standard defaults change for many reasons; only a different managed dictionary counts.
  private func notifyIfChanged() {
    let configuration = current()
    lock.lock()
    let changed = lastSeen.map { !$0.isEqual(to: configuration) } ?? false
    lastSeen = configuration as NSDictionary
    lock.unlock()
    if changed {
      sendEvent(changedEvent)
    }
  }
}
