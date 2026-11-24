import CoreGraphics
import ExpoModulesCore
import UIKit

struct PageCorner: Record {
  @Field var x: Double = 0
  @Field var y: Double = 0
}

struct PageCorners: Record {
  @Field var topLeft: PageCorner = PageCorner()
  @Field var topRight: PageCorner = PageCorner()
  @Field var bottomRight: PageCorner = PageCorner()
  @Field var bottomLeft: PageCorner = PageCorner()

  init() {}

  init(quad: PageQuad) {
    self.init()
    topLeft = PageCorner(point: quad.topLeft)
    topRight = PageCorner(point: quad.topRight)
    bottomRight = PageCorner(point: quad.bottomRight)
    bottomLeft = PageCorner(point: quad.bottomLeft)
  }

  // CAP-018-R10
  func quad() throws -> PageQuad {
    let points = [topLeft, topRight, bottomRight, bottomLeft].map { CGPoint(x: $0.x, y: $0.y) }
    guard let quad = PageQuad.manual(points) else {
      throw PhotoUnreadableException()
    }
    return quad
  }
}

extension PageCorner {
  init(point: CGPoint) {
    self.init()
    x = Double(point.x)
    y = Double(point.y)
  }
}

// CAP-018-R10, CAP-018-R11
struct CroppedPage: Record {
  @Field var page: EncryptedFile = EncryptedFile()
  @Field var thumbnail: EncryptedFile = EncryptedFile()
  @Field var corners: PageCorners? = nil
  @Field var width: Int = 0
  @Field var height: Int = 0
}

// CAP-018-R03, CAP-018-R08
struct ScannedPage: Record {
  @Field var page: EncryptedFile = EncryptedFile()
  @Field var thumbnail: EncryptedFile = EncryptedFile()
  @Field var original: EncryptedFile = EncryptedFile()
  @Field var corners: PageCorners? = nil
  @Field var width: Int = 0
  @Field var height: Int = 0

  init() {}

  init(cropped: CroppedPage) {
    self.init()
    page = cropped.page
    thumbnail = cropped.thumbnail
    corners = cropped.corners
    width = cropped.width
    height = cropped.height
  }
}

// CAP-018-R02, CAP-009-R11
struct CapturedPage: Record {
  @Field var id: String = ""
  @Field var preview: String? = nil
}

// CAP-015-R10
enum TorchMode: String, Enumerable {
  case on
  case off
}

final class ScannerNotReadyException: Exception, @unchecked Sendable {
  override var code: String { "scanner-not-ready" }
  override var reason: String { "The document scanner camera is not running or is already capturing" }
}

// NAB-191–195, Q-050, CAP-018-R02, CAP-018-R03, CAP-018-R04, CAP-018-R10, CAP-018-R11, CAP-018-R13
public final class DocumentScannerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DocumentScanner")

    AsyncFunction("recropPage") { (original: EncryptedFile, corners: PageCorners, quarterTurns: Int) -> CroppedPage in
      try DocumentScannerPages.shared.recrop(original: original, corners: corners, quarterTurns: quarterTurns)
    }.runOnQueue(DocumentScannerPages.shared.queue)

    AsyncFunction("scannedPage") { (id: String) -> ScannedPage in
      try DocumentScannerPages.shared.scanned(id: id)
    }.runOnQueue(DocumentScannerPages.shared.queue)

    View(DocumentScannerView.self) {
      Events("onEdgesChange", "onCameraUnavailable")

      Prop("isActive", false) { (view: DocumentScannerView, isActive: Bool) in
        view.isActive = isActive
      }

      Prop("torchMode", TorchMode.off) { (view: DocumentScannerView, torchMode: TorchMode) in
        view.torchMode = torchMode
      }

      Prop("edgeColor") { (view: DocumentScannerView, color: UIColor?) in
        view.edgeColor = color
      }

      Prop("edgeFillColor") { (view: DocumentScannerView, color: UIColor?) in
        view.edgeFillColor = color
      }

      AsyncFunction("capturePage") { (view: DocumentScannerView, promise: Promise) in
        view.capturePage(promise)
      }
    }
  }
}
