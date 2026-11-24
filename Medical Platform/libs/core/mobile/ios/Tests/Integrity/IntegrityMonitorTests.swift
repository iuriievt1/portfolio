import Foundation

// CAP-008-R01, CAP-008-S02
@main
struct IntegrityMonitorTests {
  static var failures = 0
  static let shortInterval = DispatchTimeInterval.milliseconds(10)
  static let longInterval = DispatchTimeInterval.seconds(60)
  static let settle: TimeInterval = 0.1
  static let patience = DispatchTimeInterval.seconds(5)

  final class Probe {
    private let lock = NSLock()
    private var checkCount = 0
    private var reported: [[IntegritySignal]] = []
    private let found: [IntegritySignal]
    let checked = DispatchSemaphore(value: 0)
    let reportedOnce = DispatchSemaphore(value: 0)

    init(_ found: [IntegritySignal] = []) {
      self.found = found
    }

    var checks: Int {
      lock.lock()
      defer { lock.unlock() }
      return checkCount
    }

    var reports: [[IntegritySignal]] {
      lock.lock()
      defer { lock.unlock() }
      return reported
    }

    func detect() -> [IntegritySignal] {
      lock.lock()
      checkCount += 1
      lock.unlock()
      checked.signal()
      return found
    }

    func report(_ signals: [IntegritySignal]) {
      lock.lock()
      reported.append(signals)
      lock.unlock()
      reportedOnce.signal()
    }
  }

  static func monitorOf(_ probe: Probe, interval: DispatchTimeInterval = shortInterval) -> IntegrityMonitor {
    let monitor = IntegrityMonitor(detect: probe.detect, report: probe.report, interval: interval)
    monitor.enterForeground()
    return monitor
  }

  static func main() {
    checkReportsDebugger()
    checkKeepsChecking()
    checkWaitsForListener()
    checkWaitsForForeground()
    checkRestsInBackground()
    checkStopsWithoutListener()
    print(failures == 0 ? "PASS" : "FAIL \(failures)")
    exit(failures == 0 ? 0 : 1)
  }

  static func checkReportsDebugger() {
    let probe = Probe([.debugger])
    let monitor = monitorOf(probe)

    monitor.observe(true)

    expect(probe.reportedOnce.wait(timeout: .now() + patience) == .success, "CAP-008-S02 reports a debugger attached while the app is open")
    expect(probe.reports.first == [.debugger], "CAP-008-S02 reports what it found")
    monitor.observe(false)
  }

  static func checkKeepsChecking() {
    let probe = Probe()
    let monitor = monitorOf(probe)

    monitor.observe(true)

    let threeChecks = (0..<3).allSatisfy { _ in probe.checked.wait(timeout: .now() + patience) == .success }
    expect(threeChecks, "CAP-008-R01 keeps checking while the app is open")
    expect(probe.reports.isEmpty, "reports nothing on a clean device")
    monitor.observe(false)
  }

  static func checkWaitsForListener() {
    let probe = Probe()
    let monitor = monitorOf(probe)

    Thread.sleep(forTimeInterval: settle)

    expect(probe.checks == 0, "checks nothing until the app listens")
    _ = monitor
  }

  static func checkWaitsForForeground() {
    let probe = Probe()
    let monitor = IntegrityMonitor(detect: probe.detect, report: probe.report, interval: shortInterval)

    monitor.observe(true)
    Thread.sleep(forTimeInterval: settle)

    expect(probe.checks == 0, "CAP-008-R01 checks nothing until the app is known to be in the foreground")
    monitor.enterForeground()
    expect(probe.checked.wait(timeout: .now() + patience) == .success, "CAP-008-R01 checks once the app is in the foreground")
    monitor.observe(false)
  }

  static func checkRestsInBackground() {
    let probe = Probe()
    let monitor = monitorOf(probe, interval: longInterval)
    monitor.observe(true)
    _ = probe.checked.wait(timeout: .now() + patience)

    monitor.enterBackground()
    Thread.sleep(forTimeInterval: settle)
    let inBackground = probe.checks
    monitor.enterForeground()

    expect(inBackground == 1, "CAP-008-R01 rests in the background")
    expect(probe.checked.wait(timeout: .now() + patience) == .success, "CAP-008-R01 checks at once on return")
    expect(probe.checks == 2, "CAP-008-R01 checks once on return")
    monitor.observe(false)
  }

  static func checkStopsWithoutListener() {
    let probe = Probe()
    let monitor = monitorOf(probe, interval: longInterval)
    monitor.observe(true)
    _ = probe.checked.wait(timeout: .now() + patience)

    monitor.observe(false)
    monitor.enterBackground()
    monitor.enterForeground()
    Thread.sleep(forTimeInterval: settle)

    expect(probe.checks == 1, "stops when the app stops listening")
  }

  static func expect(_ condition: Bool, _ name: String) {
    if !condition {
      failures += 1
      print("FAIL: \(name)")
    }
  }
}
