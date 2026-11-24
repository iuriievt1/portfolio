import Foundation

// CAP-008-R01, CAP-008-S02
final class IntegrityMonitor {
  static let interval = DispatchTimeInterval.seconds(30)

  private let queue = DispatchQueue(label: "cz.veevoy.ansora.integrity-monitor")
  private let detect: () -> [IntegritySignal]
  private let report: ([IntegritySignal]) -> Void
  private let interval: DispatchTimeInterval
  private var timer: DispatchSourceTimer?
  private var isObserved = false
  private var isForeground = false

  init(
    detect: @escaping () -> [IntegritySignal],
    report: @escaping ([IntegritySignal]) -> Void,
    interval: DispatchTimeInterval = IntegrityMonitor.interval
  ) {
    self.detect = detect
    self.report = report
    self.interval = interval
  }

  deinit {
    timer?.cancel()
  }

  func observe(_ observed: Bool) {
    queue.async { [weak self] in
      self?.isObserved = observed
      self?.reschedule()
    }
  }

  func enterForeground() {
    queue.async { [weak self] in
      self?.isForeground = true
      self?.reschedule()
    }
  }

  func enterBackground() {
    queue.async { [weak self] in
      self?.isForeground = false
      self?.reschedule()
    }
  }

  private func reschedule() {
    timer?.cancel()
    timer = nil
    guard isObserved && isForeground else {
      return
    }
    let next = DispatchSource.makeTimerSource(queue: queue)
    next.schedule(deadline: .now(), repeating: interval)
    next.setEventHandler { [weak self] in
      self?.check()
    }
    next.resume()
    timer = next
  }

  private func check() {
    let signals = detect()
    if !signals.isEmpty {
      report(signals)
    }
  }
}
