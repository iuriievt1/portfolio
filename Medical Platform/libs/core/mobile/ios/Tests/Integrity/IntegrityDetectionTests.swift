import Foundation

// CAP-008-R02, CAP-008-R10
@main
struct IntegrityDetectionTests {
  static var failures = 0
  static let release = IntegrityPolicy(isDevelopmentBuild: false)
  static let development = IntegrityPolicy(isDevelopmentBuild: true)

  struct FakeEvidence: IntegrityEvidence {
    var isSimulator = false
    var isAppOnMac = false
    var files: Set<String> = []
    var writableOutsideSandbox = false
    var images = ["/private/var/containers/Bundle/Application/1/AnsoraVulna.app/AnsoraVulna", "/usr/lib/libSystem.B.dylib"]
    var variables: [String: String] = [:]
    var info: [String: String] = [:]
    var traced = false

    func exists(_ path: String) -> Bool { files.contains(path) }
    func canWriteOutsideSandbox() -> Bool { writableOutsideSandbox }
    func loadedImages() -> [String] { images }
    func environment(_ name: String) -> String? { variables[name] }
    func infoValue(_ key: String) -> Any? { info[key] }
    func isTraced() -> Bool { traced }
  }

  static func main() {
    checkStockPhone()
    checkJailbreakFiles()
    checkSandboxEscape()
    checkTweakInjection()
    checkFrida()
    checkDebugger()
    checkSimulator()
    checkDevelopmentBuild()
    checkDevelopmentBuildStillReportsJailbreak()
    checkTampering()
    checkEverySignal()
    checkRealEvidence()
    print(failures == 0 ? "PASS" : "FAIL \(failures)")
    exit(failures == 0 ? 0 : 1)
  }

  static func checkStockPhone() {
    expect(IntegrityDetection.detect(FakeEvidence(), policy: release) == [], "CAP-008-S04 finds nothing on a stock iPhone")
  }

  static func checkJailbreakFiles() {
    let rootless = FakeEvidence(files: ["/var/jb"])
    let classic = FakeEvidence(files: ["/Applications/Cydia.app"])

    expect(IntegrityDetection.detect(rootless, policy: release) == [.jailbreak], "CAP-008-R02 reports a rootless jailbreak")
    expect(IntegrityDetection.detect(classic, policy: release) == [.jailbreak], "CAP-008-R02 reports a classic jailbreak")
  }

  static func checkSandboxEscape() {
    let escaped = FakeEvidence(writableOutsideSandbox: true)

    expect(IntegrityDetection.detect(escaped, policy: release) == [.jailbreak], "CAP-008-R02 reports a broken sandbox")
  }

  static func checkTweakInjection() {
    var injected = FakeEvidence()
    injected.images.append("/var/jb/usr/lib/TweakInject/Tweak.dylib")

    expect(IntegrityDetection.detect(injected, policy: release) == [.jailbreak], "CAP-008-R02 reports an injected tweak")
  }

  static func checkFrida() {
    var gadget = FakeEvidence()
    gadget.images.append("/private/var/containers/Bundle/Application/1/AnsoraVulna.app/Frameworks/FridaGadget.dylib")
    let server = FakeEvidence(files: ["/usr/sbin/frida-server"])

    expect(IntegrityDetection.detect(gadget, policy: release) == [.frida], "CAP-008-R02 reports Frida in the app")
    expect(IntegrityDetection.detect(server, policy: release) == [.frida], "CAP-008-R02 reports the Frida server")
  }

  static func checkDebugger() {
    let traced = FakeEvidence(traced: true)

    expect(IntegrityDetection.detect(traced, policy: release) == [.debugger], "CAP-008-S02 reports an attached debugger")
  }

  static func checkSimulator() {
    let simulator = FakeEvidence(isSimulator: true, files: ["/bin/bash", "/usr/sbin/sshd"])
    let mac = FakeEvidence(isAppOnMac: true, files: ["/bin/bash"])

    expect(IntegrityDetection.detect(simulator, policy: release) == [.emulator], "CAP-008-S06 reports the simulator without calling the Mac a jailbreak")
    expect(IntegrityDetection.detect(mac, policy: release) == [.emulator], "CAP-008-S06 reports an iPhone app running on a Mac")
  }

  static func checkDevelopmentBuild() {
    let developer = FakeEvidence(isSimulator: true, variables: [IntegrityDetection.insertedLibraries: "libMainThreadChecker.dylib"], traced: true)

    expect(IntegrityDetection.detect(developer, policy: development) == [], "CAP-008-S06 lets a development build run under Xcode in the simulator")
  }

  static func checkDevelopmentBuildStillReportsJailbreak() {
    var tampered = FakeEvidence(files: ["/var/jb", "/usr/sbin/frida-server"])
    tampered.images.append("/var/jb/usr/lib/TweakInject/Tweak.dylib")

    expect(
      IntegrityDetection.detect(tampered, policy: development) == [.jailbreak, .frida],
      "CAP-008-S06 still reports a jailbreak and Frida in a development build"
    )
  }

  static func checkTampering() {
    let inserted = FakeEvidence(variables: [IntegrityDetection.insertedLibraries: "/tmp/hook.dylib"])
    let cracked = FakeEvidence(info: [IntegrityDetection.crackSignerKey: "Apple iPhone OS Application Signing"])

    expect(IntegrityDetection.detect(inserted, policy: release) == [.appIntegrity], "CAP-008-R02 reports libraries inserted into the app")
    expect(IntegrityDetection.detect(cracked, policy: release) == [.appIntegrity], "CAP-008-R02 reports a cracked app")
    expect(IntegrityDetection.detect(cracked, policy: development) == [.appIntegrity], "CAP-008-R02 reports a cracked app in any build")
  }

  static func checkEverySignal() {
    var everything = FakeEvidence(files: ["/var/jb", "/usr/sbin/frida-server"], traced: true)
    everything.variables[IntegrityDetection.insertedLibraries] = "/tmp/hook.dylib"

    expect(
      IntegrityDetection.detect(everything, policy: release) == [.jailbreak, .frida, .debugger, .appIntegrity],
      "CAP-008-R10 reports every signal it finds"
    )
  }

  static func checkRealEvidence() {
    let evidence = DeviceIntegrityEvidence()

    expect(!evidence.loadedImages().isEmpty, "reads the images loaded into the process")
    expect(!evidence.isTraced(), "sees no debugger on an untraced process")
    expect(!evidence.exists("/var/jb"), "finds no jailbreak on the build machine")
  }

  static func expect(_ condition: Bool, _ name: String) {
    if !condition {
      failures += 1
      print("FAIL: \(name)")
    }
  }
}
