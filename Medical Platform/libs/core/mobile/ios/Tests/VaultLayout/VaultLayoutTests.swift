import Foundation

// CAP-009-S05, ADR-038, Q-076
@main
struct VaultLayoutTests {
  static var failures = 0

  static func main() throws {
    try checkSetAsideKeepsEveryFile()
    try checkSetAsideOfMissingDirectory()
    try checkEraseKeepsOnlyTheRetainedEntries()
    print(failures == 0 ? "PASS" : "FAIL \(failures)")
    exit(failures == 0 ? 0 : 1)
  }

  static func checkSetAsideKeepsEveryFile() throws {
    let root = try temporaryRoot()
    defer { try? FileManager.default.removeItem(at: root) }
    let queue = root.appendingPathComponent("queue", isDirectory: true)
    try FileManager.default.createDirectory(at: queue, withIntermediateDirectories: true)
    try Data("sealed".utf8).write(to: queue.appendingPathComponent("photo"))

    let aside = try VaultLayout.setAside(queue, at: Date(timeIntervalSince1970: 1_760_870_000))

    expect(aside?.lastPathComponent == "queue.set-aside.1760870000000", "CAP-009-S05 names the set-aside storage by its moment")
    expect(!FileManager.default.fileExists(atPath: queue.path), "CAP-009-S05 frees the place for a new storage")
    let kept = aside.map { FileManager.default.contents(atPath: $0.appendingPathComponent("photo").path) } ?? nil
    expect(kept == Data("sealed".utf8), "CAP-009-S05 keeps the unreadable file on the device")
  }

  static func checkSetAsideOfMissingDirectory() throws {
    let root = try temporaryRoot()
    defer { try? FileManager.default.removeItem(at: root) }

    let aside = try VaultLayout.setAside(root.appendingPathComponent("queue", isDirectory: true), at: Date())

    expect(aside == nil, "CAP-009-S05 has nothing to set aside without a storage")
  }

  static func checkEraseKeepsOnlyTheRetainedEntries() throws {
    let root = try temporaryRoot()
    defer { try? FileManager.default.removeItem(at: root) }
    let queue = root.appendingPathComponent("queue", isDirectory: true)
    try FileManager.default.createDirectory(at: queue, withIntermediateDirectories: true)
    try Data("sealed".utf8).write(to: queue.appendingPathComponent("photo"))
    try Data("{}".utf8).write(to: root.appendingPathComponent("pins.json"))

    try VaultLayout.erase(root, keeping: ["pins.json"])

    let left = try FileManager.default.contentsOfDirectory(atPath: root.path)
    expect(left == ["pins.json"], "CAP-007-R04 erases every storage of the vault and keeps only the retained entries")
  }

  static func temporaryRoot() throws -> URL {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    return root
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
