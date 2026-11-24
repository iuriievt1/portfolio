import Foundation
import ImageIO
import UniformTypeIdentifiers

// mobilni-aplikace.md 4.1
private let thumbnailLongerSide = 1024
private let thumbnailQuality = 0.7
// CAP-015-R05
private let conversionQuality = 1.0

// E18
enum PhotoPreparationFailure: Error {
  case unreadable
}

enum PhotoPreparation {
  // CAP-015-R14, CAP-015-R05, CAP-015-S06, E18
  static func upright(_ photo: [UInt8]) throws -> PreparedJpeg {
    do {
      return try LosslessJpeg.upright(photo)
    } catch JpegFailure.unsupported {
      return try readable { try LosslessJpeg.upright(try baseline(photo)) }
    } catch {
      throw PhotoPreparationFailure.unreadable
    }
  }

  // mobilni-aplikace.md 4.1
  static func thumbnail(of photo: [UInt8]) throws -> [UInt8] {
    let options: [CFString: Any] = [
      kCGImageSourceCreateThumbnailFromImageAlways: true,
      kCGImageSourceCreateThumbnailWithTransform: true,
      kCGImageSourceThumbnailMaxPixelSize: thumbnailLongerSide,
    ]
    guard let source = CGImageSourceCreateWithData(Data(photo) as CFData, nil),
      let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary)
    else {
      throw PhotoPreparationFailure.unreadable
    }
    return try jpeg(of: image, quality: thumbnailQuality)
  }

  // mobilni-aplikace.md 4.1, CAP-015-R14
  static func jpeg(of image: CGImage, quality: Double) throws -> [UInt8] {
    let encoded = try encode(image, quality: quality)
    return try readable { try LosslessJpeg.withoutMetadata(encoded) }
  }

  // CAP-015-R05
  private static func baseline(_ photo: [UInt8]) throws -> [UInt8] {
    guard let source = CGImageSourceCreateWithData(Data(photo) as CFData, nil),
      let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
      let width = properties[kCGImagePropertyPixelWidth] as? Int,
      let height = properties[kCGImagePropertyPixelHeight] as? Int
    else {
      throw PhotoPreparationFailure.unreadable
    }
    let options: [CFString: Any] = [
      kCGImageSourceCreateThumbnailFromImageAlways: true,
      kCGImageSourceCreateThumbnailWithTransform: true,
      kCGImageSourceThumbnailMaxPixelSize: max(width, height),
    ]
    guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else {
      throw PhotoPreparationFailure.unreadable
    }
    return try encode(image, quality: conversionQuality)
  }

  private static func encode(_ image: CGImage, quality: Double) throws -> [UInt8] {
    let output = NSMutableData()
    guard let destination = CGImageDestinationCreateWithData(output, UTType.jpeg.identifier as CFString, 1, nil) else {
      throw PhotoPreparationFailure.unreadable
    }
    let properties: [CFString: Any] = [
      kCGImageDestinationLossyCompressionQuality: quality,
      kCGImagePropertyJFIFDictionary: [kCGImagePropertyJFIFIsProgressive: false],
    ]
    CGImageDestinationAddImage(destination, image, properties as CFDictionary)
    guard CGImageDestinationFinalize(destination) else {
      throw PhotoPreparationFailure.unreadable
    }
    return [UInt8](output as Data)
  }

  // E18
  static func readable<Prepared>(_ preparation: () throws -> Prepared) throws -> Prepared {
    do {
      return try preparation()
    } catch is JpegFailure {
      throw PhotoPreparationFailure.unreadable
    }
  }
}
