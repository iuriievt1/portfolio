import CoreImage
import Foundation
import ImageIO

// CAP-018-R03
private let pageQuality = 0.9
private let sharpness = 0.4
private let fallbackContrast = 1.1
private let fallbackShadows = 0.3
// CAP-018-R02
private let previewLongerSide = 512
private let previewQuality = 0.7

struct PreviewEdges {
  let quad: PageQuad
  let frame: CGSize
}

// NAB-192–194, CAP-018-R03, CAP-018-R04, CAP-018-R10
enum PageImaging {
  private static let context = CIContext(options: [.cacheIntermediates: false])
  private static let outputColorSpace = CGColorSpace(name: CGColorSpace.sRGB)

  static func image(fromJpeg bytes: [UInt8]) throws -> CIImage {
    guard let image = CIImage(data: Data(bytes), options: [.applyOrientationProperty: true]),
      !image.extent.isEmpty, !image.extent.isInfinite
    else {
      throw PhotoPreparationFailure.unreadable
    }
    return atOrigin(image)
  }

  // CAP-018-R02
  static func pageEdges(in image: CIImage, preview: PreviewEdges?) -> PageQuad? {
    if let document = PageDetection.document(in: image) {
      return document
    }
    if let preview {
      return preview.quad.converted(from: preview.frame, to: image.extent.size)
    }
    return PageDetection.rectangle(in: image)
  }

  // CAP-018-R03, CAP-018-R10, CAP-018-R11
  static func page(from image: CIImage, edges: PageQuad?, quarterTurns: Int) throws -> PreparedJpeg {
    let straightened = try edges.map { try perspectiveCorrected(image, to: $0) } ?? image
    let turned = atOrigin(straightened.oriented(PageGeometry.clockwiseOrientation(quarterTurns: quarterTurns)))
    return try encoded(sharpened(enhanced(turned)), quality: pageQuality)
  }

  // CAP-018-R02, CAP-018-R03
  static func preview(of photo: Data, edges: PreviewEdges?) throws -> Data {
    let options: [CFString: Any] = [
      kCGImageSourceCreateThumbnailFromImageAlways: true,
      kCGImageSourceCreateThumbnailWithTransform: true,
      kCGImageSourceThumbnailMaxPixelSize: previewLongerSide,
    ]
    guard let source = CGImageSourceCreateWithData(photo as CFData, nil),
      let small = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary)
    else {
      throw PhotoPreparationFailure.unreadable
    }
    let image = CIImage(cgImage: small)
    let quad = edges.map { $0.quad.converted(from: $0.frame, to: image.extent.size) }
    let straightened = try quad.map { try perspectiveCorrected(image, to: $0) } ?? image
    return Data(try encoded(enhanced(straightened), quality: previewQuality).bytes)
  }

  private static func perspectiveCorrected(_ image: CIImage, to edges: PageQuad) throws -> CIImage {
    let points = edges.coreImagePoints(in: image.extent.size)
    let parameters: [String: Any] = [
      kCIInputImageKey: image,
      "inputTopLeft": CIVector(cgPoint: points.topLeft),
      "inputTopRight": CIVector(cgPoint: points.topRight),
      "inputBottomRight": CIVector(cgPoint: points.bottomRight),
      "inputBottomLeft": CIVector(cgPoint: points.bottomLeft),
    ]
    guard let corrected = CIFilter(name: "CIPerspectiveCorrection", parameters: parameters)?.outputImage,
      !corrected.extent.isEmpty, !corrected.extent.isInfinite
    else {
      throw PhotoPreparationFailure.unreadable
    }
    return atOrigin(corrected)
  }

  private static func atOrigin(_ image: CIImage) -> CIImage {
    image.transformed(by: CGAffineTransform(translationX: -image.extent.minX, y: -image.extent.minY))
  }

  // NAB-193
  private static func enhanced(_ image: CIImage) -> CIImage {
    if let enhanced = CIFilter(name: "CIDocumentEnhancer", parameters: [kCIInputImageKey: image])?.outputImage {
      return enhanced.cropped(to: image.extent)
    }
    let lifted = image.applyingFilter("CIHighlightShadowAdjust", parameters: ["inputShadowAmount": fallbackShadows])
    return lifted.applyingFilter("CIColorControls", parameters: [kCIInputContrastKey: fallbackContrast])
      .cropped(to: image.extent)
  }

  // NAB-194
  private static func sharpened(_ image: CIImage) -> CIImage {
    image.clampedToExtent()
      .applyingFilter("CISharpenLuminance", parameters: [kCIInputSharpnessKey: sharpness])
      .cropped(to: image.extent)
  }

  // mobilni-aplikace.md 4.1, CAP-015-R14
  private static func encoded(_ image: CIImage, quality: Double) throws -> PreparedJpeg {
    let width = Int(image.extent.width.rounded(.down))
    let height = Int(image.extent.height.rounded(.down))
    let area = CGRect(x: image.extent.minX, y: image.extent.minY, width: CGFloat(width), height: CGFloat(height))
    guard width > 0, height > 0, let colorSpace = outputColorSpace,
      let rendered = context.createCGImage(image, from: area, format: .RGBA8, colorSpace: colorSpace)
    else {
      throw PhotoPreparationFailure.unreadable
    }
    return PreparedJpeg(bytes: try PhotoPreparation.jpeg(of: rendered, quality: quality), width: width, height: height)
  }
}
