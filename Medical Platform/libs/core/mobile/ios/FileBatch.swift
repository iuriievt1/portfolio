// CAP-009-R17
struct FileBatch<File> {
  private let store: ([UInt8]) throws -> File
  private let remove: (File) -> Void
  private(set) var stored: [File] = []

  init(store: @escaping ([UInt8]) throws -> File, remove: @escaping (File) -> Void) {
    self.store = store
    self.remove = remove
  }

  mutating func add(_ bytes: [UInt8]) throws -> File {
    let file = try store(bytes)
    stored.append(file)
    return file
  }

  func discard() {
    stored.forEach(remove)
  }
}
