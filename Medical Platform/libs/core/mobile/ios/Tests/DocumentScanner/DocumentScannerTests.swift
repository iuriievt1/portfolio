import CoreGraphics
import CoreImage
import Foundation
import ImageIO
import UniformTypeIdentifiers

// CAP-018
@main
struct DocumentScannerTests {
  static var failures = 0
  static let tolerance = 1e-9
  static let page = PageQuad(
    topLeft: CGPoint(x: 0.2, y: 0.1), topRight: CGPoint(x: 0.8, y: 0.15), bottomRight: CGPoint(x: 0.75, y: 0.9),
    bottomLeft: CGPoint(x: 0.15, y: 0.85))

  static func main() throws {
    checkOrdering()
    checkVisionCorners()
    checkManualCorners()
    checkShape()
    checkPreviewLayerMapping()
    checkFieldConversion()
    checkOrientation()
    checkPhotoDimensions()
    checkTracker()
    try checkDetectedPage()
    try checkPreviewFallback()
    try checkWholeFrame()
    try checkPagePreview()
    try checkPageRotation()
    try checkRecrop()
    checkFileBatch()
    print(failures == 0 ? "PASS" : "FAIL \(failures)")
    exit(failures == 0 ? 0 : 1)
  }

  static func checkOrdering() {
    for permutation in permutations(page.corners) {
      expect(PageQuad.ordered(permutation) == page, "CAP-018-R02 corners ordered \(permutation)")
    }
    let diamond = [CGPoint(x: 0.5, y: 0), CGPoint(x: 1, y: 0.5), CGPoint(x: 0.5, y: 1), CGPoint(x: 0, y: 0.5)]
    let ordered = PageQuad.ordered(diamond.reversed())
    expect(ordered?.topLeft == CGPoint(x: 0.5, y: 0) && ordered?.isConvex == true, "diamond starts at the top")
    expect(PageQuad.ordered(Array(page.corners.prefix(3))) == nil, "three corners rejected")
  }

  static func checkVisionCorners() {
    let quad = PageQuad.fromVision(
      topLeft: CGPoint(x: 0.2, y: 0.9), topRight: CGPoint(x: 0.8, y: 0.85), bottomRight: CGPoint(x: 0.75, y: 0.1),
      bottomLeft: CGPoint(x: 0.15, y: 0.15))
    expect(quad.map { $0.maximumDistance(to: page) < tolerance } == true, "Vision corners flipped to top-left origin")
  }

  // CAP-018-R10
  static func checkManualCorners() {
    let crossed = [page.topRight, page.topLeft, page.bottomRight, page.bottomLeft]
    expect(PageQuad.manual(crossed) == page, "CAP-018-R10 crossed handles reordered")
    let outside = PageQuad.manual([
      CGPoint(x: -0.2, y: -1), CGPoint(x: 1.4, y: 0), CGPoint(x: 1, y: 3), CGPoint(x: 0, y: 1),
    ])
    expect(outside == PageQuad.wholeFrame, "CAP-018-R10 handles clamped to the photo")
    expect(PageQuad.manual([page.topLeft, page.topRight, CGPoint(x: .nan, y: 0.5), page.bottomLeft]) == nil, "NaN rejected")
    let concave = [CGPoint(x: 0, y: 0), CGPoint(x: 1, y: 0), CGPoint(x: 0.3, y: 0.3), CGPoint(x: 0, y: 1)]
    expect(PageQuad.manual(concave) == nil, "CAP-018-R10 concave outline rejected")
    let sliver = [CGPoint(x: 0, y: 0), CGPoint(x: 1, y: 0), CGPoint(x: 1, y: 0.005), CGPoint(x: 0, y: 0.005)]
    expect(PageQuad.manual(sliver) == nil, "CAP-018-R10 degenerate outline rejected")
  }

  static func checkShape() {
    expect(abs(PageQuad.wholeFrame.area - 1) < tolerance && PageQuad.wholeFrame.isConvex, "whole frame area")
    expect(page.isDetectedPage, "page-sized quad accepted")
    let small = PageQuad.wholeFrame.mapped { CGPoint(x: 0.4 + $0.x * 0.2, y: 0.4 + $0.y * 0.2) }
    expect(!small.isDetectedPage, "CAP-018-R02 small rectangle is not a page")
    let points = page.coreImagePoints(in: CGSize(width: 100, height: 200))
    expect(close(points.topLeft, CGPoint(x: 20, y: 180)) && close(points.bottomRight, CGPoint(x: 75, y: 20)), "Core Image points")
  }

  // A.1 Skener
  static func checkPreviewLayerMapping() {
    let frame = CGSize(width: 1080, height: 1440)
    let same = PageQuad.wholeFrame.layerPoints(frame: frame, layer: CGSize(width: 393, height: 524))
    expect(close(same.bottomRight, CGPoint(x: 393, y: 524)), "same aspect fills the layer")
    let tall = PageQuad.wholeFrame.layerPoints(frame: frame, layer: CGSize(width: 393, height: 852))
    let drawnWidth = 1080 * (852.0 / 1440)
    expect(close(tall.topLeft, CGPoint(x: (393 - drawnWidth) / 2, y: 0)), "aspect fill crops the sides")
    let center = PageQuad(
      topLeft: CGPoint(x: 0.5, y: 0.5), topRight: CGPoint(x: 0.5, y: 0.5), bottomRight: CGPoint(x: 0.5, y: 0.5),
      bottomLeft: CGPoint(x: 0.5, y: 0.5))
    let centered = center.layerPoints(frame: frame, layer: CGSize(width: 393, height: 852))
    expect(close(centered.topLeft, CGPoint(x: 196.5, y: 426)), "aspect fill keeps the center")
  }

  // CAP-018-R02
  static func checkFieldConversion() {
    let photo = CGSize(width: 3024, height: 4032)
    let same = page.converted(from: CGSize(width: 1080, height: 1440), to: photo)
    expect(same.maximumDistance(to: page) < tolerance, "preview quad kept for the same aspect")
    let narrow = PageQuad.wholeFrame.converted(from: CGSize(width: 1080, height: 1920), to: photo)
    expect(close(narrow.topLeft, CGPoint(x: 0.125, y: 0)) && close(narrow.bottomRight, CGPoint(x: 0.875, y: 1)), "9:16 inside 3:4")
    let wide = PageQuad.wholeFrame.converted(from: CGSize(width: 1920, height: 1080), to: CGSize(width: 4032, height: 3024))
    expect(close(wide.topLeft, CGPoint(x: 0, y: 0.125)) && close(wide.bottomRight, CGPoint(x: 1, y: 0.875)), "16:9 inside 4:3")
  }

  static func checkOrientation() {
    let expected: [(Int, CGImagePropertyOrientation)] = [
      (0, .up), (1, .right), (2, .down), (3, .left), (-1, .left), (5, .right), (-4, .up),
    ]
    for (turns, orientation) in expected {
      expect(PageGeometry.clockwiseOrientation(quarterTurns: turns) == orientation, "CAP-018-R11 \(turns) quarter turns")
    }
    expect(PageGeometry.portraitSize(width: 1440, height: 1080) == CGSize(width: 1080, height: 1440), "portrait frame upright")
    expect(PageGeometry.portraitVisionOrientation == .right && PageGeometry.portraitRotationAngle == 90, "portrait only")
  }

  static func checkPhotoDimensions() {
    let wide = PageGeometry.photoDimensions(supported: [(4032, 3024), (8064, 6048), (5712, 4284)])
    expect(wide.map { $0 == (4032, 3024) } == true, "12 MP preferred over 24 and 48 MP")
    let older = PageGeometry.photoDimensions(supported: [(1920, 1440), (4032, 3024)])
    expect(older.map { $0 == (4032, 3024) } == true, "largest photo up to 12 MP")
    let only = PageGeometry.photoDimensions(supported: [(8064, 6048)])
    expect(only.map { $0 == (8064, 6048) } == true, "only larger photo kept")
    expect(PageGeometry.photoDimensions(supported: []) == nil, "no photo dimensions")
  }

  // CAP-018-R02
  static func checkTracker() {
    var tracker = EdgeTracker()
    for frame in 1..<EdgeTracker.steadyFrames {
      tracker.track(page)
      expect(!tracker.isFound && tracker.quad == page, "CAP-018-R02 not steady after \(frame) frames")
    }
    tracker.track(page.mapped { CGPoint(x: $0.x + 0.005, y: $0.y) })
    expect(tracker.isFound, "CAP-018-R02 found once steady")
    for _ in 1..<EdgeTracker.lostFrames {
      tracker.track(nil)
    }
    expect(tracker.isFound && tracker.quad != nil, "short miss keeps the edges")
    tracker.track(nil)
    expect(!tracker.isFound && tracker.quad == nil, "edges lost after misses")

    var moving = EdgeTracker()
    for step in 0..<(EdgeTracker.steadyFrames * 2) {
      moving.track(page.mapped { CGPoint(x: $0.x + 0.05 * Double(step % 2), y: $0.y) })
    }
    expect(!moving.isFound, "CAP-018-R02 shaking page is not found")
    let moved = page.mapped { CGPoint(x: $0.x + 0.05, y: $0.y) }
    expect(
      moving.quad.map { $0.maximumDistance(to: moved) > 0 && $0.maximumDistance(to: moved) < 0.05 } == true,
      "small move smoothed")
    let far = page.mapped { CGPoint(x: $0.x * 0.5, y: $0.y * 0.5) }
    moving.track(far)
    expect(moving.quad == far, "far move snaps")

    var interrupted = EdgeTracker()
    for _ in 0..<EdgeTracker.steadyFrames {
      interrupted.track(page)
      interrupted.track(nil)
    }
    expect(interrupted.isFound, "single misses do not break steadiness")
  }

  // CAP-018-S01, NAB-191–194
  static func checkDetectedPage() throws {
    let drawn = try photo(width: 1200, height: 1600, page: true)
    let original = try PhotoPreparation.upright(drawn.jpeg)
    let image = try PageImaging.image(fromJpeg: original.bytes)
    let edges = PageImaging.pageEdges(in: image, preview: nil)
    expect(edges.map { $0.maximumDistance(to: drawn.page) < 0.02 } == true, "CAP-018-S01 page edges found \(String(describing: edges))")
    let scanned = try PageImaging.page(from: image, edges: edges, quarterTurns: 0)
    let file = try JpegFile.parse(scanned.bytes)
    expect(file.frameMarker == JpegMarker.baselineFrame, "CAP-018-S01 page baseline")
    expect(!file.segments.contains { $0.marker == JpegMarker.exif }, "CAP-018-S01 page without Exif")
    let size = LosslessJpegFrame.size(of: file)
    expect(size.width == scanned.width && size.height == scanned.height, "page size reported")
    expect(abs(Double(scanned.width) - 720) < 30 && abs(Double(scanned.height) - 1000) < 40, "CAP-018-S01 perspective straightened \(scanned.width)x\(scanned.height)")
    let corners = try brightness(of: scanned.bytes, at: [(0.03, 0.03), (0.97, 0.03), (0.97, 0.97), (0.03, 0.97)])
    expect(corners.allSatisfy { $0 > 0.6 }, "CAP-018-S01 background cropped away \(corners)")
    let thumbnail = try PhotoPreparation.thumbnail(of: scanned.bytes)
    expect(try JpegFile.parse(thumbnail).frameMarker == JpegMarker.baselineFrame, "page thumbnail baseline")
  }

  // CAP-018-R02
  static func checkPreviewFallback() throws {
    let blank = try photo(width: 1200, height: 1600, page: false)
    let image = try PageImaging.image(fromJpeg: try PhotoPreparation.upright(blank.jpeg).bytes)
    let preview = PreviewEdges(quad: page, frame: CGSize(width: 1080, height: 1440))
    let edges = PageImaging.pageEdges(in: image, preview: preview)
    expect(edges.map { $0.maximumDistance(to: page) < tolerance } == true, "CAP-018-R02 preview edges used when the photo has none")
  }

  // CAP-018-S02, CAP-018-R10
  static func checkWholeFrame() throws {
    let blank = try photo(width: 1200, height: 1600, page: false)
    let image = try PageImaging.image(fromJpeg: try PhotoPreparation.upright(blank.jpeg).bytes)
    expect(PageImaging.pageEdges(in: image, preview: nil) == nil, "CAP-018-S02 no edges on a blank photo")
    let whole = try PageImaging.page(from: image, edges: nil, quarterTurns: 0)
    expect(whole.width == 1200 && whole.height == 1600, "CAP-018-S02 page kept whole")
    let manual = try PageImaging.page(from: image, edges: PageQuad.manual(page.corners), quarterTurns: 0)
    expect(manual.width > 0 && manual.width < 1200, "CAP-018-R10 manual corners applied")
  }

  // CAP-018-R02
  static func checkPagePreview() throws {
    let drawn = try photo(width: 1200, height: 1600, page: true)
    let preview = PreviewEdges(quad: drawn.page, frame: CGSize(width: 1080, height: 1440))
    let small = try PageImaging.preview(of: Data(drawn.jpeg), edges: preview)
    let size = LosslessJpegFrame.size(of: try JpegFile.parse([UInt8](small)))
    expect(max(size.width, size.height) <= 512 && size.width < size.height, "CAP-018-R02 small straightened preview \(size)")
    let corners = try brightness(of: [UInt8](small), at: [(0.03, 0.03), (0.97, 0.03), (0.97, 0.97), (0.03, 0.97)])
    expect(corners.allSatisfy { $0 > 0.6 }, "CAP-018-R02 preview background cropped away \(corners)")
  }

  // CAP-018-R11, CAP-015-R34
  static func checkPageRotation() throws {
    let marked = try PageImaging.image(fromJpeg: try markedPhoto(width: 400, height: 600))
    let upright = try PageImaging.page(from: marked, edges: nil, quarterTurns: 0)
    expect(try brightness(of: upright.bytes, at: [markCorner])[0] < darkMark, "mark at the top left")
    let clockwise = try PageImaging.page(from: marked, edges: nil, quarterTurns: 1)
    expect(clockwise.width == 600 && clockwise.height == 400, "CAP-018-R11 quarter turn swaps the sides")
    expect(try brightness(of: clockwise.bytes, at: [(1 - markCorner.0, markCorner.1)])[0] < darkMark, "CAP-018-R11 mark turned to the top right")
    let upsideDown = try PageImaging.page(from: marked, edges: nil, quarterTurns: 2)
    expect(try brightness(of: upsideDown.bytes, at: [(1 - markCorner.0, 1 - markCorner.1)])[0] < darkMark, "CAP-018-R11 half turn")
    let counter = try PageImaging.page(from: marked, edges: nil, quarterTurns: -1)
    expect(try brightness(of: counter.bytes, at: [(markCorner.0, 1 - markCorner.1)])[0] < darkMark, "CAP-018-R11 negative turn")
  }

  // CAP-018-R10, CAP-018-R11
  static func checkRecrop() throws {
    let drawn = try photo(width: 1200, height: 1600, page: true)
    let image = try PageImaging.image(fromJpeg: try PhotoPreparation.upright(drawn.jpeg).bytes)
    let first = try PageImaging.page(from: image, edges: drawn.page, quarterTurns: 1)
    let outside = PageQuad.manual(drawn.page.corners.map { CGPoint(x: $0.x * 1.5 - 0.25, y: $0.y * 1.5 - 0.25) })
    expect(outside.map { $0.corners.allSatisfy { (0...1).contains($0.x) && (0...1).contains($0.y) } } == true, "CAP-018-R10 recrop corners clamped")
    let second = try PageImaging.page(from: image, edges: drawn.page, quarterTurns: 1)
    expect(first.width == second.width && first.height == second.height, "CAP-018-R11 recrop from the original is repeatable")
    expect(second.width > second.height, "CAP-018-R11 recrop keeps the rotation")
  }

  // CAP-009-R17
  static func checkFileBatch() {
    var removed: [Int] = []
    var batch = FileBatch<Int>(store: { $0.count }, remove: { removed.append($0) })
    _ = try? batch.add([1])
    _ = try? batch.add([1, 2])
    expect(batch.stored == [1, 2], "stored files listed")
    batch.discard()
    expect(removed == [1, 2], "CAP-009-R17 failed batch leaves no file")
    var failing = FileBatch<Int>(store: { if $0.isEmpty { throw PhotoPreparationFailure.unreadable }; return $0.count }, remove: { removed.append($0) })
    _ = try? failing.add([7, 7, 7])
    expect((try? failing.add([])) == nil && failing.stored == [3], "failed store not listed")
  }

  static let markCorner = (0.1, 0.1)
  static let darkMark = 0.3

  static func markedPhoto(width: Int, height: Int) throws -> [UInt8] {
    guard
      let context = CGContext(
        data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
        space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)
    else {
      throw PhotoPreparationFailure.unreadable
    }
    context.setFillColor(CGColor(red: 0.97, green: 0.97, blue: 0.95, alpha: 1))
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    context.setFillColor(CGColor(red: 0, green: 0, blue: 0, alpha: 1))
    let side = CGFloat(min(width, height)) * 0.2
    context.fill(CGRect(x: 0, y: CGFloat(height) - side, width: side, height: side))
    guard let image = context.makeImage() else {
      throw PhotoPreparationFailure.unreadable
    }
    return try PhotoPreparation.jpeg(of: image, quality: 0.95)
  }

  static func photo(width: Int, height: Int, page hasPage: Bool) throws -> (jpeg: [UInt8], page: PageQuad) {
    guard
      let context = CGContext(
        data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
        space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)
    else {
      throw PhotoPreparationFailure.unreadable
    }
    context.setFillColor(CGColor(red: 0.22, green: 0.2, blue: 0.18, alpha: 1))
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    let pageSize = CGSize(width: 720, height: 1000)
    let transform = CGAffineTransform(translationX: CGFloat(width) / 2, y: CGFloat(height) / 2)
      .rotated(by: 0.12)
      .translatedBy(x: -pageSize.width / 2, y: -pageSize.height / 2)
    if hasPage {
      context.saveGState()
      context.concatenate(transform)
      context.setFillColor(CGColor(red: 0.97, green: 0.97, blue: 0.95, alpha: 1))
      context.fill(CGRect(origin: .zero, size: pageSize))
      context.setFillColor(CGColor(red: 0.1, green: 0.1, blue: 0.1, alpha: 1))
      for line in 0..<20 {
        context.fill(CGRect(x: 80, y: 120 + CGFloat(line) * 38, width: 420 + CGFloat(line % 4) * 40, height: 12))
      }
      context.restoreGState()
    }
    guard let image = context.makeImage() else {
      throw PhotoPreparationFailure.unreadable
    }
    let output = NSMutableData()
    guard let destination = CGImageDestinationCreateWithData(output, UTType.jpeg.identifier as CFString, 1, nil) else {
      throw PhotoPreparationFailure.unreadable
    }
    CGImageDestinationAddImage(
      destination, image,
      [
        kCGImageDestinationLossyCompressionQuality: 0.92,
        kCGImagePropertyJFIFDictionary: [kCGImagePropertyJFIFIsProgressive: false],
      ] as CFDictionary)
    guard CGImageDestinationFinalize(destination) else {
      throw PhotoPreparationFailure.unreadable
    }
    let corners = [
      CGPoint(x: 0, y: pageSize.height), CGPoint(x: pageSize.width, y: pageSize.height),
      CGPoint(x: pageSize.width, y: 0), CGPoint(x: 0, y: 0),
    ].map { $0.applying(transform) }.map { CGPoint(x: $0.x / CGFloat(width), y: 1 - $0.y / CGFloat(height)) }
    return ([UInt8](output as Data), PageQuad.ordered(corners)!)
  }

  static func brightness(of jpeg: [UInt8], at points: [(Double, Double)]) throws -> [Double] {
    guard let source = CGImageSourceCreateWithData(Data(jpeg) as CFData, nil),
      let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
    else {
      throw PhotoPreparationFailure.unreadable
    }
    let width = image.width
    let height = image.height
    var pixels = [UInt8](repeating: 0, count: width * height * 4)
    guard
      let context = CGContext(
        data: &pixels, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
        space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)
    else {
      throw PhotoPreparationFailure.unreadable
    }
    context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    return points.map { point in
      let x = min(Int(point.0 * Double(width)), width - 1)
      let y = min(Int(point.1 * Double(height)), height - 1)
      let offset = (y * width + x) * 4
      return Double(Int(pixels[offset]) + Int(pixels[offset + 1]) + Int(pixels[offset + 2])) / (3 * 255)
    }
  }

  static func permutations(_ points: [CGPoint]) -> [[CGPoint]] {
    guard points.count > 1 else {
      return [points]
    }
    return points.indices.flatMap { index -> [[CGPoint]] in
      var rest = points
      let first = rest.remove(at: index)
      return permutations(rest).map { [first] + $0 }
    }
  }

  static func close(_ first: CGPoint, _ second: CGPoint) -> Bool {
    abs(first.x - second.x) < 1e-6 && abs(first.y - second.y) < 1e-6
  }

  static func expect(_ condition: @autoclosure () throws -> Bool, _ name: String) {
    let passed = (try? condition()) ?? false
    if !passed {
      failures += 1
    }
    print("\(passed ? "ok  " : "FAIL") \(name)")
  }
}

enum LosslessJpegFrame {
  static func size(of file: JpegFile) -> (width: Int, height: Int) {
    guard let frame = file.segments.first(where: { JpegMarker.frames.contains($0.marker) }) else {
      return (0, 0)
    }
    return (Int(frame.payload[3]) << 8 | Int(frame.payload[4]), Int(frame.payload[1]) << 8 | Int(frame.payload[2]))
  }
}
