import Foundation

struct PreparedJpeg {
  let bytes: [UInt8]
  let width: Int
  let height: Int
}

struct PixelRect {
  let x: Double
  let y: Double
  let width: Double
  let height: Double
}

// CAP-015-R14, CAP-015-R34, CAP-015-R03, Q-068, Q-131
enum LosslessJpeg {
  // ITU-T T.81 B.2.2
  private static let frameDimensionsBytes = 5

  // CAP-015-R14, Q-068
  static func upright(_ bytes: [UInt8]) throws -> PreparedJpeg {
    let file = try JpegFile.parse(bytes)
    guard file.frameMarker == JpegMarker.baselineFrame else {
      throw JpegFailure.unsupported
    }
    let header = JpegMetadata.cleanedHeader(from: file)
    let orientation = JpegMetadata.orientation(of: file)
    guard orientation == .topLeft else {
      let image = try CoefficientImage.decode(file).upright(from: orientation)
      return PreparedJpeg(bytes: try image.encoded(header: header), width: image.width, height: image.height)
    }
    let size = try frameSize(of: file)
    return PreparedJpeg(bytes: try replacingMetadata(of: file, with: header), width: size.width, height: size.height)
  }

  // mobilni-aplikace.md 4.1
  static func withoutMetadata(_ bytes: [UInt8]) throws -> [UInt8] {
    let file = try JpegFile.parse(bytes)
    return try replacingMetadata(of: file, with: JpegMetadata.keptHeader(from: file))
  }

  private static func replacingMetadata(of file: JpegFile, with header: [JpegSegment]) throws -> [UInt8] {
    let coding = file.parts.filter { part in
      if case let .segment(segment) = part {
        return !JpegMetadata.isMetadata(segment)
      }
      return true
    }
    return try JpegFile(parts: header.map(JpegPart.segment) + coding).serialized()
  }

  // CAP-015-R34
  static func rotatedClockwise(_ bytes: [UInt8], quarterTurns: Int) throws -> PreparedJpeg {
    let file = try JpegFile.parse(bytes)
    let image = try CoefficientImage.decode(file).rotatedClockwise(quarterTurns: quarterTurns)
    return PreparedJpeg(
      bytes: try image.encoded(header: JpegMetadata.cleanedHeader(from: file)), width: image.width,
      height: image.height)
  }

  // CAP-015-R34, CAP-015-R03
  static func cropped(_ bytes: [UInt8], to rect: PixelRect) throws -> PreparedJpeg {
    let file = try JpegFile.parse(bytes)
    let image = try CoefficientImage.decode(file)
    let left = gridStart(rect.x, step: image.mcuWidth, size: image.width)
    let top = gridStart(rect.y, step: image.mcuHeight, size: image.height)
    let right = gridEnd(rect.x + rect.width, start: left, step: image.mcuWidth, size: image.width)
    let bottom = gridEnd(rect.y + rect.height, start: top, step: image.mcuHeight, size: image.height)
    let cut = image.cropped(x: left, y: top, width: right - left, height: bottom - top)
    return PreparedJpeg(
      bytes: try cut.encoded(header: JpegMetadata.cleanedHeader(from: file)), width: cut.width, height: cut.height)
  }

  private static func gridStart(_ value: Double, step: Int, size: Int) -> Int {
    let last = max(size - step, 0) / step * step
    return min(gridLine(value, step: step, size: size), last)
  }

  private static func gridEnd(_ value: Double, start: Int, step: Int, size: Int) -> Int {
    min(max(gridLine(value, step: step, size: size), start + step), size)
  }

  private static func gridLine(_ value: Double, step: Int, size: Int) -> Int {
    let steps = value / Double(step)
    guard !steps.isNaN, steps > 0 else {
      return 0
    }
    let stepsPastEdge = Double(size / step + 1)
    return Int(min(steps, stepsPastEdge).rounded()) * step
  }

  private static func frameSize(of file: JpegFile) throws -> (width: Int, height: Int) {
    guard let frame = file.segments.first(where: { $0.marker == JpegMarker.baselineFrame }),
      frame.payload.count >= frameDimensionsBytes
    else {
      throw JpegFailure.malformed
    }
    let height = Int(frame.payload[1]) << 8 | Int(frame.payload[2])
    let width = Int(frame.payload[3]) << 8 | Int(frame.payload[4])
    return (width, height)
  }
}
