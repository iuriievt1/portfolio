import Foundation

// NAB-412
enum VaultLayout {
  private static let directoryName = "vault"
  private static let setAsideInfix = ".set-aside."
  private static let millisecondsPerSecond = 1000.0

  static func exists(fileManager: FileManager = .default) -> Bool {
    guard let base = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
      return false
    }
    return fileManager.fileExists(atPath: base.appendingPathComponent(directoryName, isDirectory: true).path)
  }

  static func root(fileManager: FileManager = .default) throws -> URL {
    let base = try fileManager.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
    var root = base.appendingPathComponent(directoryName, isDirectory: true)
    guard !fileManager.fileExists(atPath: root.path) else {
      return root
    }
    try fileManager.createDirectory(at: root, withIntermediateDirectories: true)
    var values = URLResourceValues()
    values.isExcludedFromBackup = true
    try root.setResourceValues(values)
    return root
  }

  // CAP-007-R04, CAP-009-R14
  static func eraseAll(keeping retained: Set<String>, fileManager: FileManager = .default) throws {
    try erase(try root(fileManager: fileManager), keeping: retained, fileManager: fileManager)
  }

  static func erase(_ directory: URL, keeping retained: Set<String>, fileManager: FileManager = .default) throws {
    for entry in try fileManager.contentsOfDirectory(atPath: directory.path) where !retained.contains(entry) {
      try fileManager.removeItem(at: directory.appendingPathComponent(entry))
    }
  }

  // CAP-009-S05, ADR-038, Q-076
  @discardableResult
  static func setAside(_ directory: URL, at date: Date, fileManager: FileManager = .default) throws -> URL? {
    guard fileManager.fileExists(atPath: directory.path) else {
      return nil
    }
    let stamp = Int64(date.timeIntervalSince1970 * millisecondsPerSecond)
    let aside = directory.deletingLastPathComponent()
      .appendingPathComponent("\(directory.lastPathComponent)\(setAsideInfix)\(stamp)", isDirectory: true)
    try fileManager.moveItem(at: directory, to: aside)
    return aside
  }
}
