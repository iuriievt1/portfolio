import Foundation

enum JpegFailure: Error, Equatable {
  case malformed
  case unsupported
}

enum JpegMarker {
  static let prefix: UInt8 = 0xFF
  static let stuffing: UInt8 = 0x00
  static let startOfImage: UInt8 = 0xD8
  static let endOfImage: UInt8 = 0xD9
  static let startOfScan: UInt8 = 0xDA
  static let quantizationTables: UInt8 = 0xDB
  static let huffmanTables: UInt8 = 0xC4
  static let restartInterval: UInt8 = 0xDD
  static let baselineFrame: UInt8 = 0xC0
  static let restarts: ClosedRange<UInt8> = 0xD0...0xD7
  static let applications: ClosedRange<UInt8> = 0xE0...0xEF
  static let comment: UInt8 = 0xFE
  static let frames: Set<UInt8> = [0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF]
  static let jfif: UInt8 = 0xE0
  static let exif: UInt8 = 0xE1
  static let iccProfile: UInt8 = 0xE2
  static let adobe: UInt8 = 0xEE
}

struct JpegSegment {
  let marker: UInt8
  let payload: [UInt8]
}

struct JpegScan {
  let header: [UInt8]
  let entropyData: [UInt8]
}

enum JpegPart {
  case segment(JpegSegment)
  case scan(JpegScan)
}

struct JpegFile {
  private static let lengthBytes = 2
  private static let maximumSegmentLength = 0xFFFF

  var parts: [JpegPart]

  var segments: [JpegSegment] {
    parts.compactMap { part in
      if case let .segment(segment) = part {
        return segment
      }
      return nil
    }
  }

  var frameMarker: UInt8? {
    segments.first { JpegMarker.frames.contains($0.marker) }?.marker
  }

  // ITU-T T.81 B.1.1
  static func parse(_ bytes: [UInt8]) throws -> JpegFile {
    guard bytes.count > 3, bytes[0] == JpegMarker.prefix, bytes[1] == JpegMarker.startOfImage else {
      throw JpegFailure.malformed
    }
    var parts: [JpegPart] = []
    var position = 2
    while true {
      guard position < bytes.count, bytes[position] == JpegMarker.prefix else {
        throw JpegFailure.malformed
      }
      while position < bytes.count, bytes[position] == JpegMarker.prefix {
        position += 1
      }
      guard position < bytes.count else {
        throw JpegFailure.malformed
      }
      let marker = bytes[position]
      position += 1
      if marker == JpegMarker.endOfImage {
        return JpegFile(parts: parts)
      }
      guard position + lengthBytes <= bytes.count else {
        throw JpegFailure.malformed
      }
      let length = Int(bytes[position]) << 8 | Int(bytes[position + 1])
      guard length >= lengthBytes, position + length <= bytes.count else {
        throw JpegFailure.malformed
      }
      let payload = Array(bytes[(position + lengthBytes)..<(position + length)])
      position += length
      guard marker == JpegMarker.startOfScan else {
        parts.append(.segment(JpegSegment(marker: marker, payload: payload)))
        continue
      }
      let end = try entropyDataEnd(in: bytes, from: position)
      parts.append(.scan(JpegScan(header: payload, entropyData: Array(bytes[position..<end]))))
      position = end
    }
  }

  // ITU-T T.81 B.1.1.5
  private static func entropyDataEnd(in bytes: [UInt8], from start: Int) throws -> Int {
    var position = start
    while position + 1 < bytes.count {
      guard bytes[position] == JpegMarker.prefix else {
        position += 1
        continue
      }
      let next = bytes[position + 1]
      if next == JpegMarker.stuffing || JpegMarker.restarts.contains(next) {
        position += 2
        continue
      }
      return position
    }
    throw JpegFailure.malformed
  }

  func serialized() throws -> [UInt8] {
    var bytes: [UInt8] = [JpegMarker.prefix, JpegMarker.startOfImage]
    for part in parts {
      switch part {
      case let .segment(segment):
        try JpegFile.append(marker: segment.marker, payload: segment.payload, to: &bytes)
      case let .scan(scan):
        try JpegFile.append(marker: JpegMarker.startOfScan, payload: scan.header, to: &bytes)
        bytes.append(contentsOf: scan.entropyData)
      }
    }
    bytes.append(contentsOf: [JpegMarker.prefix, JpegMarker.endOfImage])
    return bytes
  }

  private static func append(marker: UInt8, payload: [UInt8], to bytes: inout [UInt8]) throws {
    let length = payload.count + lengthBytes
    guard length <= maximumSegmentLength else {
      throw JpegFailure.malformed
    }
    bytes.append(contentsOf: [JpegMarker.prefix, marker, UInt8(length >> 8), UInt8(length & 0xFF)])
    bytes.append(contentsOf: payload)
  }
}
