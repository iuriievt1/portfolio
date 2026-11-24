import Foundation

// libjpeg-turbo
@main
struct LosslessJpegTests {
  static let work = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("lossless-jpeg-tests")
  static var failures = 0

  static func main() throws {
    try? FileManager.default.removeItem(at: work)
    try FileManager.default.createDirectory(at: work, withIntermediateDirectories: true)
    let samplings = ["2x2", "2x1", "1x1"]
    for sampling in samplings {
      for size in [(64, 48), (640, 480), (100, 75)] {
        let source = try camera(width: size.0, height: size.1, sampling: sampling, restart: nil)
        try checkOrientations(source, label: "\(sampling) \(size.0)x\(size.1)")
        try checkRotations(source, label: "\(sampling) \(size.0)x\(size.1)")
        try checkCrop(source, label: "\(sampling) \(size.0)x\(size.1)")
      }
    }
    try checkOrientations(try camera(width: 640, height: 480, sampling: "2x2", restart: "3B"), label: "restart 3B")
    try checkOrientations(try camera(width: 640, height: 480, sampling: "2x2", restart: "1"), label: "restart 1 row")
    try checkOrientations(try camera(width: 96, height: 64, sampling: nil, restart: nil), label: "grayscale")
    try checkMetadata()
    try checkUprightCopiesTheScan()
    try checkThumbnail()
    try checkProgressiveConversion()
    try checkCameraFrameKept()
    try checkEdgeCropRotates()
    try checkCropOutsideTheFrame()
    try checkJfifThumbnailDropped()
    print(failures == 0 ? "PASS" : "FAIL \(failures)")
    exit(failures == 0 ? 0 : 1)
  }

  static func checkOrientations(_ source: [UInt8], label: String) throws {
    let transforms: [ExifOrientation: [String]] = [
      .topRight: ["-flip", "horizontal"], .bottomRight: ["-rotate", "180"], .bottomLeft: ["-flip", "vertical"],
      .leftTop: ["-transpose"], .rightTop: ["-rotate", "90"], .rightBottom: ["-transverse"], .leftBottom: ["-rotate", "270"],
    ]
    for (orientation, arguments) in transforms.sorted(by: { $0.key.rawValue < $1.key.rawValue }) {
      let tagged = withMetadata(source, orientation: orientation.rawValue)
      let ours = try LosslessJpeg.upright(tagged)
      let reference = try jpegtran(tagged, arguments + ["-trim"])
      let name = "CAP-015-S07 \(label) orientation \(orientation.rawValue)"
      expect(try decoded(ours.bytes) == decoded(reference), "\(name) pixels")
      expect(JpegMetadata.orientation(of: try JpegFile.parse(ours.bytes)) == .topLeft, "\(name) tag")
    }
  }

  // CAP-015-R34
  static func checkRotations(_ source: [UInt8], label: String) throws {
    let upright = try LosslessJpeg.upright(withMetadata(source, orientation: 1)).bytes
    for turns in 1...3 {
      let ours = try LosslessJpeg.rotatedClockwise(upright, quarterTurns: turns)
      let reference = try jpegtran(upright, ["-rotate", String(turns * 90), "-trim"])
      expect(try decoded(ours.bytes) == decoded(reference), "\(label) rotate \(turns * 90)")
    }
  }

  // CAP-015-R03
  static func checkCrop(_ source: [UInt8], label: String) throws {
    let upright = try LosslessJpeg.upright(withMetadata(source, orientation: 1)).bytes
    let ours = try LosslessJpeg.cropped(upright, to: PixelRect(x: 17, y: 15, width: 30, height: 18))
    let reference = try jpegtran(upright, ["-crop", "\(ours.width)x\(ours.height)+16+16"])
    expect(try decoded(ours.bytes) == decoded(reference), "\(label) crop pixels")
  }

  // CAP-015-R14, Q-068, Q-085
  static func checkMetadata() throws {
    let source = try camera(width: 64, height: 48, sampling: "2x2", restart: nil)
    let tagged = withMetadata(source, orientation: 6)
    let cleaned = try LosslessJpeg.upright(tagged).bytes
    let file = try JpegFile.parse(cleaned)
    let applications = file.segments.filter { JpegMarker.applications.contains($0.marker) }
    expect(!contains(cleaned, Array("VulnaPhone".utf8)), "device identification removed")
    expect(!contains(cleaned, Array("http://ns.adobe.com/xap/1.0/".utf8)), "XMP removed")
    expect(!contains(cleaned, Array("bed 12".utf8)), "comment removed")
    expect(applications.contains { $0.marker == JpegMarker.iccProfile && $0.payload == iccSegment }, "ICC kept")
    expect(file.frameMarker == JpegMarker.baselineFrame, "baseline")
    expect(Array(cleaned.suffix(2)) == [0xFF, 0xD9], "nothing after EOI")
  }

  // CAP-015-R14
  static func checkUprightCopiesTheScan() throws {
    let source = try camera(width: 640, height: 480, sampling: "2x2", restart: nil)
    let cleaned = try LosslessJpeg.upright(withMetadata(source, orientation: 1)).bytes
    expect(scans(of: cleaned) == scans(of: source), "scan unchanged")
  }

  // mobilni-aplikace.md 4.1, ADR-026
  static func checkThumbnail() throws {
    let photo = try LosslessJpeg.upright(withMetadata(try camera(width: 2000, height: 1500, sampling: "2x2", restart: nil), orientation: 6))
    let thumbnail = try PhotoPreparation.thumbnail(of: photo.bytes)
    let file = try JpegFile.parse(thumbnail)
    let size = frameSize(of: file)
    let expectedWidth = Int((Double(photo.width) * 1024 / Double(photo.height)).rounded())
    expect(size.height == 1024 && abs(size.width - expectedWidth) <= 1, "thumbnail longer side 1024, upright")
    expect(file.frameMarker == JpegMarker.baselineFrame, "thumbnail baseline")
    expect(!file.segments.contains { $0.marker == JpegMarker.exif }, "thumbnail without Exif")
  }

  // CAP-015-R05
  static func checkProgressiveConversion() throws {
    let progressive = try camera(width: 640, height: 480, sampling: "2x2", restart: nil, progressive: true)
    let prepared = try PhotoPreparation.upright(withMetadata(progressive, orientation: 6))
    let file = try JpegFile.parse(prepared.bytes)
    expect(file.frameMarker == JpegMarker.baselineFrame, "CAP-015-S06 progressive converted to baseline")
    expect(prepared.width == 480 && prepared.height == 640, "CAP-015-S06 converted photo upright")
    expect(JpegMetadata.orientation(of: file) == .topLeft, "CAP-015-S06 converted photo orientation 1")
    expect(
      !contains(prepared.bytes, Array("VulnaPhone".utf8)), "CAP-015-S06 converted photo without device identification")
  }

  // CAP-015-R03, CAP-015-R34
  static func checkCameraFrameKept() throws {
    let source = try camera(width: 4032, height: 3024, sampling: "2x2", restart: nil)
    let upright = try LosslessJpeg.upright(withMetadata(source, orientation: 6))
    expect(upright.width == 3024 && upright.height == 4032, "camera frame upright without trim")
    for turns in 1...3 {
      let turned = try LosslessJpeg.rotatedClockwise(upright.bytes, quarterTurns: turns)
      let size = turns == 2 ? (3024, 4032) : (4032, 3024)
      expect(turned.width == size.0 && turned.height == size.1, "camera frame rotate \(turns * 90) without trim")
    }
    let cut = try LosslessJpeg.cropped(upright.bytes, to: PixelRect(x: 411.3, y: 977.8, width: 1503.6, height: 1999.1))
    expect(cut.width % 16 == 0 && cut.height % 16 == 0, "crop on the block grid")
    let turnedCut = try LosslessJpeg.rotatedClockwise(cut.bytes, quarterTurns: 1)
    expect(turnedCut.width == cut.height && turnedCut.height == cut.width, "cropped frame rotates without trim")
  }

  // CAP-015-R03, CAP-015-R34
  static func checkEdgeCropRotates() throws {
    let source = try camera(width: 100, height: 75, sampling: "2x2", restart: nil)
    let upright = try LosslessJpeg.upright(withMetadata(source, orientation: 1))
    let cut = try LosslessJpeg.cropped(upright.bytes, to: PixelRect(x: 95, y: 70, width: 5, height: 5))
    expect(cut.width >= 16 && cut.height >= 16, "edge crop keeps a whole block")
    let ours = try LosslessJpeg.rotatedClockwise(cut.bytes, quarterTurns: 1)
    let reference = try jpegtran(cut.bytes, ["-rotate", "90", "-trim"])
    expect(try decoded(ours.bytes) == decoded(reference), "edge crop rotates without padding")
  }

  // CAP-015-R03
  static func checkCropOutsideTheFrame() throws {
    let source = try camera(width: 64, height: 48, sampling: "2x2", restart: nil)
    let upright = try LosslessJpeg.upright(withMetadata(source, orientation: 1))
    let huge = try LosslessJpeg.cropped(upright.bytes, to: PixelRect(x: -1e300, y: 1e300, width: .infinity, height: 1e300))
    expect(huge.width == 64 && huge.height == 16, "crop beyond the frame stays inside it")
    let undefined = try LosslessJpeg.cropped(upright.bytes, to: PixelRect(x: .nan, y: .nan, width: .nan, height: .nan))
    expect(undefined.width == 16 && undefined.height == 16, "crop without a number keeps one block")
  }

  // ITU-T T.871 10.1
  static func checkJfifThumbnailDropped() throws {
    let source = try JpegFile.parse(try camera(width: 64, height: 48, sampling: "2x2", restart: nil))
    let thumbnailPixels = Array("THUMB!".utf8)
    let parts = source.parts.map { part -> JpegPart in
      guard case let .segment(segment) = part, segment.marker == JpegMarker.jfif else {
        return part
      }
      let header = Array(segment.payload.prefix(12))
      return .segment(JpegSegment(marker: segment.marker, payload: header + [2, 1] + thumbnailPixels))
    }
    let withThumbnail = try JpegFile(parts: parts).serialized()
    let outputs = [
      try LosslessJpeg.upright(withThumbnail).bytes,
      try LosslessJpeg.cropped(withThumbnail, to: PixelRect(x: 16, y: 16, width: 16, height: 16)).bytes,
      try LosslessJpeg.withoutMetadata(withThumbnail),
    ]
    for (index, output) in outputs.enumerated() {
      let jfif = try JpegFile.parse(output).segments.filter { $0.marker == JpegMarker.jfif }
      let isHeaderOnly = jfif.count == 1 && jfif[0].payload.count == 14 && jfif[0].payload.suffix(2) == [0, 0]
      expect(isHeaderOnly, "JFIF \(index) without thumbnail")
      expect(!contains(output, thumbnailPixels), "JFIF \(index) thumbnail pixels removed")
    }
  }

  static func frameSize(of file: JpegFile) -> (width: Int, height: Int) {
    guard let frame = file.segments.first(where: { JpegMarker.frames.contains($0.marker) }) else {
      return (0, 0)
    }
    return (Int(frame.payload[3]) << 8 | Int(frame.payload[4]), Int(frame.payload[1]) << 8 | Int(frame.payload[2]))
  }

  static func camera(width: Int, height: Int, sampling: String?, restart: String?, progressive: Bool = false) throws
    -> [UInt8]
  {
    var pixels = "P6\n\(width) \(height)\n255\n".utf8.map { $0 }
    for y in 0..<height {
      for x in 0..<width {
        let red = UInt8((x * 255) / max(width - 1, 1))
        let green = UInt8((y * 255) / max(height - 1, 1))
        let blue = UInt8(((x / 7 + y / 5) % 2) * 200 + (x * y) % 55)
        pixels.append(contentsOf: [red, green, blue])
      }
    }
    var arguments = ["-quality", "88"]
    if let sampling {
      arguments += ["-sample", sampling]
    } else {
      arguments += ["-grayscale"]
    }
    if let restart {
      arguments += ["-restart", restart]
    }
    if progressive {
      arguments += ["-progressive"]
    }
    return try run("cjpeg", arguments, input: pixels)
  }

  static let iccSegment = Array("ICC_PROFILE\0".utf8) + [1, 1] + Array(repeating: 0x42, count: 40)

  static func withMetadata(_ jpeg: [UInt8], orientation: Int) -> [UInt8] {
    let tiff: [UInt8] = [
      0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00,
      0x02, 0x00,
      0x0F, 0x01, 0x02, 0x00, 0x0B, 0x00, 0x00, 0x00, 0x26, 0x00, 0x00, 0x00,
      0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, UInt8(orientation), 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
    ] + Array("VulnaPhone\0".utf8)
    let exif = Array("Exif\0\0".utf8) + tiff
    let xmp = Array("http://ns.adobe.com/xap/1.0/\0<x:xmpmeta/>".utf8)
    let comment = Array("bed 12".utf8)
    var result: [UInt8] = [0xFF, 0xD8]
    for (marker, payload) in [(UInt8(0xE1), exif), (0xE1, xmp), (0xE2, iccSegment), (0xFE, comment)] {
      let length = payload.count + 2
      result += [0xFF, marker, UInt8(length >> 8), UInt8(length & 0xFF)] + payload
    }
    return result + jpeg.dropFirst(2) + Array("trailing gain map".utf8)
  }

  static func scans(of jpeg: [UInt8]) -> [[UInt8]] {
    guard let file = try? JpegFile.parse(jpeg) else {
      return []
    }
    return file.parts.compactMap { part in
      if case let .scan(scan) = part {
        return scan.entropyData
      }
      return nil
    }
  }

  static func jpegtran(_ jpeg: [UInt8], _ arguments: [String]) throws -> [UInt8] {
    try run("jpegtran", ["-copy", "none"] + arguments, input: jpeg)
  }

  static func decoded(_ jpeg: [UInt8]) throws -> [UInt8] {
    try run("djpeg", ["-ppm"], input: jpeg)
  }

  static func run(_ tool: String, _ arguments: [String], input: [UInt8]) throws -> [UInt8] {
    let inputFile = work.appendingPathComponent(UUID().uuidString)
    try Data(input).write(to: inputFile)
    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
    process.arguments = [tool] + arguments + [inputFile.path]
    let output = Pipe()
    let errors = Pipe()
    process.standardOutput = output
    process.standardError = errors
    try process.run()
    let data = output.fileHandleForReading.readDataToEndOfFile()
    let warnings = errors.fileHandleForReading.readDataToEndOfFile()
    process.waitUntilExit()
    if process.terminationStatus != 0 || !warnings.isEmpty {
      failures += 1
      print("FAIL \(tool) \(arguments): \(String(decoding: warnings, as: UTF8.self))")
    }
    return [UInt8](data)
  }

  static func contains(_ haystack: [UInt8], _ needle: [UInt8]) -> Bool {
    guard haystack.count >= needle.count else {
      return false
    }
    return (0...(haystack.count - needle.count)).contains { Array(haystack[$0..<($0 + needle.count)]) == needle }
  }

  static func expect(_ condition: @autoclosure () throws -> Bool, _ name: String) {
    let passed = (try? condition()) ?? false
    if !passed {
      failures += 1
    }
    print("\(passed ? "ok  " : "FAIL") \(name)")
  }
}
