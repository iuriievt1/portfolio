import CoreImage
import CoreVideo
import ImageIO
import Vision

// NAB-191, CAP-018-R02, CAP-018-R04, CAP-018-R13
enum PageDetection {
  private static let minimumDocumentConfidence: Float = 0.5
  private static let minimumRectangleConfidence: Float = 0.6
  private static let minimumRectangleSize: Float = 0.2
  private static let minimumRectangleAspectRatio: Float = 0.3
  private static let rectangleQuadratureTolerance: Float = 30

  static func page(in buffer: CVPixelBuffer, orientation: CGImagePropertyOrientation) -> PageQuad? {
    let handler = VNImageRequestHandler(cvPixelBuffer: buffer, orientation: orientation)
    return document(using: handler) ?? rectangle(using: handler)
  }

  static func document(in image: CIImage) -> PageQuad? {
    document(using: VNImageRequestHandler(ciImage: image, orientation: .up))
  }

  static func rectangle(in image: CIImage) -> PageQuad? {
    rectangle(using: VNImageRequestHandler(ciImage: image, orientation: .up))
  }

  private static func document(using handler: VNImageRequestHandler) -> PageQuad? {
    let request = VNDetectDocumentSegmentationRequest()
    guard (try? handler.perform([request])) != nil,
      let observation = request.results?.first,
      observation.confidence >= minimumDocumentConfidence
    else {
      return nil
    }
    return page(of: observation)
  }

  private static func rectangle(using handler: VNImageRequestHandler) -> PageQuad? {
    let request = VNDetectRectanglesRequest()
    request.maximumObservations = 1
    request.minimumConfidence = minimumRectangleConfidence
    request.minimumSize = minimumRectangleSize
    request.minimumAspectRatio = minimumRectangleAspectRatio
    request.quadratureTolerance = rectangleQuadratureTolerance
    guard (try? handler.perform([request])) != nil, let observation = request.results?.first else {
      return nil
    }
    return page(of: observation)
  }

  private static func page(of observation: VNRectangleObservation) -> PageQuad? {
    guard
      let quad = PageQuad.fromVision(
        topLeft: observation.topLeft, topRight: observation.topRight, bottomRight: observation.bottomRight,
        bottomLeft: observation.bottomLeft),
      quad.isDetectedPage
    else {
      return nil
    }
    return quad
  }
}
