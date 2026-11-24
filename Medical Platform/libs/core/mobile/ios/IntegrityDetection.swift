import Foundation

// CAP-008-R02, identity.yaml IntegrityReport
enum IntegritySignal: String {
  case jailbreak
  case frida
  case debugger
  case emulator
  case appIntegrity = "app_integrity"
}

protocol IntegrityEvidence {
  var isSimulator: Bool { get }
  var isAppOnMac: Bool { get }
  func exists(_ path: String) -> Bool
  func canWriteOutsideSandbox() -> Bool
  func loadedImages() -> [String]
  func environment(_ name: String) -> String?
  func infoValue(_ key: String) -> Any?
  func isTraced() -> Bool
}

struct IntegrityPolicy {
  let isDevelopmentBuild: Bool
}

// CAP-008-R01, CAP-008-R02, CAP-008-R10, zarizeni-a-sifrovani.md 3
enum IntegrityDetection {
  private static let jailbreakPaths = [
    "/Applications/Cydia.app",
    "/Applications/Sileo.app",
    "/Applications/Zebra.app",
    "/Applications/Installer.app",
    "/Library/MobileSubstrate/MobileSubstrate.dylib",
    "/Library/MobileSubstrate/DynamicLibraries",
    "/bin/bash",
    "/usr/sbin/sshd",
    "/usr/libexec/sftp-server",
    "/usr/libexec/cydia",
    "/usr/bin/cycript",
    "/usr/lib/libcycript.dylib",
    "/usr/lib/libjailbreak.dylib",
    "/usr/share/jailbreak/injectme.plist",
    "/etc/apt",
    "/etc/ssh/sshd_config",
    "/private/var/lib/apt",
    "/private/var/lib/cydia",
    "/private/var/stash",
    "/var/lib/dpkg/info",
    "/var/jb",
    "/var/binpack",
    "/.bootstrapped",
    "/.installed_dopamine",
  ]
  private static let tweakImageMarkers = [
    "mobilesubstrate",
    "substrateloader",
    "substrateinserter",
    "libhooker",
    "tweakinject",
    "libsubstitute",
    "substitute-inserter",
    "ellekit",
    "systemhook.dylib",
    "cephei",
    "rocketbootstrap",
    "sslkillswitch",
    "cycript",
    "/var/jb/",
  ]
  private static let fridaPaths = [
    "/usr/sbin/frida-server",
    "/usr/bin/frida-server",
    "/usr/lib/frida/frida-agent.dylib",
    "/var/jb/usr/sbin/frida-server",
  ]
  private static let fridaImageMarkers = ["frida", "gum-js"]
  static let insertedLibraries = "DYLD_INSERT_LIBRARIES"
  static let crackSignerKey = "SignerIdentity"

  static func detect(_ evidence: IntegrityEvidence, policy: IntegrityPolicy) -> [IntegritySignal] {
    let images = evidence.loadedImages().map { $0.lowercased() }
    let emulator = evidence.isSimulator || evidence.isAppOnMac
    var signals: [IntegritySignal] = []
    if !emulator && isJailbroken(evidence, images: images) {
      signals.append(.jailbreak)
    }
    if hasFrida(evidence, images: images) {
      signals.append(.frida)
    }
    // CAP-008-S06
    if !policy.isDevelopmentBuild && evidence.isTraced() {
      signals.append(.debugger)
    }
    if !policy.isDevelopmentBuild && emulator {
      signals.append(.emulator)
    }
    if isTampered(evidence, policy: policy) {
      signals.append(.appIntegrity)
    }
    return signals
  }

  private static func isJailbroken(_ evidence: IntegrityEvidence, images: [String]) -> Bool {
    jailbreakPaths.contains(where: evidence.exists) ||
      evidence.canWriteOutsideSandbox() ||
      images.contains { image in tweakImageMarkers.contains(where: image.contains) }
  }

  private static func hasFrida(_ evidence: IntegrityEvidence, images: [String]) -> Bool {
    fridaPaths.contains(where: evidence.exists) ||
      images.contains { image in fridaImageMarkers.contains(where: image.contains) }
  }

  private static func isTampered(_ evidence: IntegrityEvidence, policy: IntegrityPolicy) -> Bool {
    if evidence.infoValue(crackSignerKey) != nil {
      return true
    }
    return !policy.isDevelopmentBuild && evidence.environment(insertedLibraries) != nil
  }
}
