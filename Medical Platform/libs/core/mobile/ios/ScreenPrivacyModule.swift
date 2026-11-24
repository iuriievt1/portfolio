import ExpoModulesCore
import UIKit

public final class ScreenPrivacyModule: Module {
  private let cover = PrivacyCover()

  public func definition() -> ModuleDefinition {
    Name("ScreenPrivacy")

    OnCreate {
      self.cover.startObserving()
    }

    OnDestroy {
      self.cover.stopObserving()
    }

    // CAP-013-R04, CAP-001-R09
    Function("allowSystemSheet") { (allowed: Bool) in
      DispatchQueue.main.async {
        self.cover.allowSystemSheet(allowed)
      }
    }
  }
}

final class PrivacyCover {
  private var observers: [NSObjectProtocol] = []
  private var coverViews: [UIView] = []
  private var isSystemSheetAllowed = false

  func startObserving() {
    let center = NotificationCenter.default
    observers = [
      center.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) { [weak self] _ in
        guard let self, !self.isSystemSheetAllowed else {
          return
        }
        self.show()
      },
      center.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in
        self?.show()
      },
      center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
        self?.hide()
      },
    ]
  }

  func allowSystemSheet(_ allowed: Bool) {
    isSystemSheetAllowed = allowed
  }

  func stopObserving() {
    observers.forEach(NotificationCenter.default.removeObserver)
    observers = []
    DispatchQueue.main.async { [weak self] in
      self?.hide()
    }
  }

  private func show() {
    guard coverViews.isEmpty else {
      return
    }
    for window in visibleWindows() {
      let cover = UIView(frame: window.bounds)
      cover.backgroundColor = .systemBackground
      cover.autoresizingMask = [.flexibleWidth, .flexibleHeight]
      window.addSubview(cover)
      coverViews.append(cover)
    }
  }

  private func hide() {
    coverViews.forEach { $0.removeFromSuperview() }
    coverViews = []
  }

  private func visibleWindows() -> [UIWindow] {
    UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap(\.windows)
      .filter { !$0.isHidden }
  }
}
