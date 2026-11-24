import Foundation

// Exif 2.3 Orientation
enum ExifOrientation: Int {
  case topLeft = 1
  case topRight = 2
  case bottomRight = 3
  case bottomLeft = 4
  case leftTop = 5
  case rightTop = 6
  case rightBottom = 7
  case leftBottom = 8
}

// CAP-015-R14, Q-068, Q-085
enum JpegMetadata {
  private static let jfifIdentifier = Array("JFIF\0".utf8)
  // ITU-T T.871 10.1
  private static let jfifHeaderBytes = 14
  private static let jfifThumbnailSizeOffset = 12
  private static let noThumbnail: [UInt8] = [0, 0]
  private static let exifIdentifier = Array("Exif\0\0".utf8)
  private static let iccIdentifier = Array("ICC_PROFILE\0".utf8)
  private static let adobeIdentifier = Array("Adobe".utf8)
  private static let bigEndianMark: [UInt8] = [0x4D, 0x4D]
  private static let littleEndianMark: [UInt8] = [0x49, 0x49]
  private static let tiffMagic = 42
  private static let orientationTag = 0x0112
  private static let shortType = 3
  private static let ifdEntryBytes = 12

  // Exif 2.3, TIFF 6.0
  private static let uprightExif: [UInt8] = exifIdentifier + [
    0x4D, 0x4D, 0x00, 0x2A, 0x00, 0x00, 0x00, 0x08,
    0x00, 0x01,
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
  ]

  static func orientation(of file: JpegFile) -> ExifOrientation {
    for segment in file.segments where segment.marker == JpegMarker.exif {
      if let orientation = orientation(inExif: segment.payload) {
        return orientation
      }
    }
    return .topLeft
  }

  static func isKept(_ segment: JpegSegment) -> Bool {
    switch segment.marker {
    case JpegMarker.jfif:
      return segment.payload.starts(with: jfifIdentifier) && segment.payload.count >= jfifHeaderBytes
    case JpegMarker.iccProfile:
      return segment.payload.starts(with: iccIdentifier)
    case JpegMarker.adobe:
      return segment.payload.starts(with: adobeIdentifier)
    default:
      return false
    }
  }

  static func isMetadata(_ segment: JpegSegment) -> Bool {
    JpegMarker.applications.contains(segment.marker) || segment.marker == JpegMarker.comment
  }

  static func cleanedHeader(from file: JpegFile) -> [JpegSegment] {
    let kept = keptHeader(from: file)
    let leading = kept.filter { $0.marker == JpegMarker.jfif }
    let trailing = kept.filter { $0.marker != JpegMarker.jfif }
    return leading + [JpegSegment(marker: JpegMarker.exif, payload: uprightExif)] + trailing
  }

  static func keptHeader(from file: JpegFile) -> [JpegSegment] {
    file.segments.filter(isKept).map(withoutThumbnail)
  }

  // ITU-T T.871 10.1
  private static func withoutThumbnail(_ segment: JpegSegment) -> JpegSegment {
    guard segment.marker == JpegMarker.jfif else {
      return segment
    }
    return JpegSegment(marker: segment.marker, payload: Array(segment.payload.prefix(jfifThumbnailSizeOffset)) + noThumbnail)
  }

  private static func orientation(inExif payload: [UInt8]) -> ExifOrientation? {
    guard payload.starts(with: exifIdentifier) else {
      return nil
    }
    let tiff = Array(payload.dropFirst(exifIdentifier.count))
    guard tiff.count >= 8 else {
      return nil
    }
    let isBigEndian: Bool
    if Array(tiff[0..<2]) == bigEndianMark {
      isBigEndian = true
    } else if Array(tiff[0..<2]) == littleEndianMark {
      isBigEndian = false
    } else {
      return nil
    }
    let reader = TiffReader(bytes: tiff, isBigEndian: isBigEndian)
    guard reader.short(at: 2) == tiffMagic, let ifd = reader.long(at: 4), let entries = reader.short(at: ifd) else {
      return nil
    }
    for index in 0..<entries {
      let entry = ifd + 2 + index * ifdEntryBytes
      guard reader.short(at: entry) == orientationTag else {
        continue
      }
      guard reader.short(at: entry + 2) == shortType, let value = reader.short(at: entry + 8) else {
        return nil
      }
      return ExifOrientation(rawValue: value)
    }
    return nil
  }
}

private struct TiffReader {
  let bytes: [UInt8]
  let isBigEndian: Bool

  func short(at offset: Int) -> Int? {
    guard offset >= 0, offset + 2 <= bytes.count else {
      return nil
    }
    let first = Int(bytes[offset])
    let second = Int(bytes[offset + 1])
    return isBigEndian ? first << 8 | second : second << 8 | first
  }

  func long(at offset: Int) -> Int? {
    guard let high = short(at: isBigEndian ? offset : offset + 2),
      let low = short(at: isBigEndian ? offset + 2 : offset)
    else {
      return nil
    }
    return high << 16 | low
  }
}
