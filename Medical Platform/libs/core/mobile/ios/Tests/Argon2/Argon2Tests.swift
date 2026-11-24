import Foundation

// RFC 9106, CAP-001-R25
@main
struct Argon2Tests {
  static let pinParameters = Argon2.Parameters(memoryKiB: 65_536, passes: 3, parallelism: 1, tagLength: 32)
  static var failures = 0

  static func main() throws {
    try checkRfc9106Vector()
    try checkPinKeysMatchAndroid()
    print(failures == 0 ? "PASS" : "FAIL \(failures)")
    exit(failures == 0 ? 0 : 1)
  }

  // RFC 9106 5.3
  static func checkRfc9106Vector() throws {
    let tag = try Argon2.hash(
      password: [UInt8](repeating: 1, count: 32),
      salt: [UInt8](repeating: 2, count: 16),
      secret: [UInt8](repeating: 3, count: 8),
      associatedData: [UInt8](repeating: 4, count: 12),
      parameters: Argon2.Parameters(memoryKiB: 32, passes: 3, parallelism: 4, tagLength: 32)
    )
    expect(hex(tag) == "0d640df58d78766c08c037a34a8b53c9d01ef0452d75b65eb52520e96b01e659", "RFC 9106 Argon2id vector")
  }

  // Argon2Test.kt
  static func checkPinKeysMatchAndroid() throws {
    let salt = Array("0123456789abcdef".utf8)
    let reference = Argon2.Parameters(memoryKiB: 1024, passes: 3, parallelism: 1, tagLength: 32)
    let golden: [(pin: String, key: String)] = [
      ("123456", "fb8b9cdc061dbbf25530cf6f5ee61697b53203c9873cca973b3e70dc6fce0431"),
      ("123457", "b9cd4d1fe3b4463537e44051a2990afecf20e2ccd39e2893c639693390732dcd"),
      ("4217", "8a77ecf9328aa58ad69749eb3ea74d986a39694553e088aa115098971e8543b8"),
    ]
    for entry in golden {
      let key = try Argon2.hash(password: Array(entry.pin.utf8), salt: salt, parameters: reference)
      expect(hex(key) == entry.key, "CAP-001-S16 PIN \(entry.pin) matches the reference")
    }
    let pinKey = try Argon2.hash(password: Array("123456".utf8), salt: salt, parameters: pinParameters)
    expect(hex(pinKey) == "430c657f7e8dcf433e1bc1946618ef5cec7b923623787ee7c3d7be8bba71242a", "PIN key matches Android")
  }

  static func hex(_ bytes: [UInt8]) -> String {
    bytes.map { String(format: "%02x", $0) }.joined()
  }

  static func expect(_ condition: Bool, _ name: String) {
    if condition {
      print("ok   \(name)")
    } else {
      failures += 1
      print("FAIL \(name)")
    }
  }
}
