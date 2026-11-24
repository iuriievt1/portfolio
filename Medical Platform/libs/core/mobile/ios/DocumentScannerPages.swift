import CoreImage
import ExpoModulesCore
import Foundation

// CAP-018-R03, CAP-018-R04, CAP-018-R08, CAP-018-R10, CAP-018-R11, CAP-009-R17
final class DocumentScannerPages {
  static let shared = DocumentScannerPages()

  let queue = DispatchQueue(label: "cz.veevoy.ansora.core.mobile.document-scanner.pages")
  private let previewQueue = DispatchQueue(label: "cz.veevoy.ansora.core.mobile.document-scanner.preview")
  private let files = EncryptedFiles(vault: Vault(), keys: MasterKeys.shared)
  private var results: [String: Result<ScannedPage, Error>] = [:]

  // CAP-018-R02, CAP-018-R03
  func capture(photo: Data, preview: PreviewEdges?, promise: Promise) {
    let id = UUID().uuidString
    queue.async {
      self.results[id] = Result { try self.scan(photo: photo, preview: preview) }
    }
    previewQueue.async {
      let captured = CapturedPage()
      captured.id = id
      captured.preview = try? PageImaging.preview(of: photo, edges: preview).base64EncodedString()
      promise.resolve(captured)
    }
  }

  // CAP-018-R08
  func scanned(id: String) throws -> ScannedPage {
    guard let result = results.removeValue(forKey: id) else {
      throw ScannerNotReadyException()
    }
    return try result.get()
  }

  // CAP-018-R10, CAP-018-R11
  func recrop(original: EncryptedFile, corners: PageCorners, quarterTurns: Int) throws -> CroppedPage {
    let edges = try corners.quad()
    let bytes = [UInt8](try files.open(path: original.path, wrappedKey: original.wrappedKey, in: .queue))
    return try autoreleasepool {
      let image = try PhotoUnreadableException.whenUnreadable { try PageImaging.image(fromJpeg: bytes) }
      var batch = newBatch()
      do {
        return try croppedPage(from: image, edges: edges, quarterTurns: quarterTurns, into: &batch)
      } catch {
        batch.discard()
        throw error
      }
    }
  }

  // CAP-015-R14, CAP-018-R02, CAP-018-R03
  private func scan(photo: Data, preview: PreviewEdges?) throws -> ScannedPage {
    try autoreleasepool {
      let original = try PhotoUnreadableException.whenUnreadable { try PhotoPreparation.upright([UInt8](photo)) }
      let image = try PhotoUnreadableException.whenUnreadable { try PageImaging.image(fromJpeg: original.bytes) }
      let edges = PageImaging.pageEdges(in: image, preview: preview)
      var batch = newBatch()
      do {
        let cropped = try croppedPage(from: image, edges: edges, quarterTurns: 0, into: &batch)
        let scanned = ScannedPage(cropped: cropped)
        scanned.original = try batch.add(original.bytes)
        return scanned
      } catch {
        batch.discard()
        throw error
      }
    }
  }

  // CAP-009-R02, CAP-009-R06
  private func croppedPage(
    from image: CIImage, edges: PageQuad?, quarterTurns: Int, into batch: inout FileBatch<EncryptedFile>
  ) throws -> CroppedPage {
    let page = try PhotoUnreadableException.whenUnreadable {
      try PageImaging.page(from: image, edges: edges, quarterTurns: quarterTurns)
    }
    let thumbnail = try PhotoUnreadableException.whenUnreadable { try PhotoPreparation.thumbnail(of: page.bytes) }
    let cropped = CroppedPage()
    cropped.page = try batch.add(page.bytes)
    cropped.thumbnail = try batch.add(thumbnail)
    cropped.corners = edges.map(PageCorners.init(quad:))
    cropped.width = page.width
    cropped.height = page.height
    return cropped
  }

  // CAP-009-R17
  private func newBatch() -> FileBatch<EncryptedFile> {
    let files = files
    return FileBatch(
      store: { try files.store(Data($0), in: .queue) },
      remove: { try? files.vault.remove($0.path) })
  }
}
