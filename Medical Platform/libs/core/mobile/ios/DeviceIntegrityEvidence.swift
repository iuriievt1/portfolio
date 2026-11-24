import Darwin
import Foundation
import MachO

// CAP-008-R01, CAP-008-R08
struct DeviceIntegrityEvidence: IntegrityEvidence {
  private static let sandboxProbeDirectory = "/private"

  var isSimulator: Bool {
    #if targetEnvironment(simulator)
    return true
    #else
    return false
    #endif
  }

  var isAppOnMac: Bool {
    ProcessInfo.processInfo.isiOSAppOnMac
  }

  func exists(_ path: String) -> Bool {
    var status = stat()
    return FileManager.default.fileExists(atPath: path) || lstat(path, &status) == 0
  }

  func canWriteOutsideSandbox() -> Bool {
    let probe = "\(Self.sandboxProbeDirectory)/\(UUID().uuidString)"
    guard FileManager.default.createFile(atPath: probe, contents: Data()) else {
      return false
    }
    try? FileManager.default.removeItem(atPath: probe)
    return true
  }

  func loadedImages() -> [String] {
    (0..<_dyld_image_count()).compactMap { index in
      _dyld_get_image_name(index).map { String(cString: $0) }
    }
  }

  func environment(_ name: String) -> String? {
    ProcessInfo.processInfo.environment[name]
  }

  func infoValue(_ key: String) -> Any? {
    Bundle.main.object(forInfoDictionaryKey: key)
  }

  func isTraced() -> Bool {
    var info = kinfo_proc()
    var size = MemoryLayout<kinfo_proc>.stride
    var request: [Int32] = [CTL_KERN, KERN_PROC, KERN_PROC_PID, getpid()]
    guard sysctl(&request, UInt32(request.count), &info, &size, nil, 0) == 0 else {
      return false
    }
    return (info.kp_proc.p_flag & P_TRACED) != 0
  }
}
