import CoreGraphics
import Foundation
import ImageIO

// CAP-018-R10
private let minimumManualArea = 0.01
// CAP-018-R02
private let minimumDetectedArea = 0.1
private let convexityEpsilon = 1e-9
private let cornerCount = 4
private let turnsPerCircle = 4
// CAP-018-R02
private let largestPhotoPixels = 4032 * 3024

struct PageQuad: Equatable {
  var topLeft: CGPoint
  var topRight: CGPoint
  var bottomRight: CGPoint
  var bottomLeft: CGPoint

  static let wholeFrame = PageQuad(
    topLeft: CGPoint(x: 0, y: 0), topRight: CGPoint(x: 1, y: 0), bottomRight: CGPoint(x: 1, y: 1),
    bottomLeft: CGPoint(x: 0, y: 1))

  var corners: [CGPoint] {
    [topLeft, topRight, bottomRight, bottomLeft]
  }

  var area: Double {
    let points = corners
    var doubled = 0.0
    for index in 0..<cornerCount {
      let current = points[index]
      let next = points[(index + 1) % cornerCount]
      doubled += Double(current.x * next.y - next.x * current.y)
    }
    return abs(doubled) / 2
  }

  var isConvex: Bool {
    let points = corners
    return (0..<cornerCount).allSatisfy { index in
      let first = points[index]
      let second = points[(index + 1) % cornerCount]
      let third = points[(index + 2) % cornerCount]
      let turn = (second.x - first.x) * (third.y - second.y) - (second.y - first.y) * (third.x - second.x)
      return Double(turn) > convexityEpsilon
    }
  }

  var isDetectedPage: Bool {
    isConvex && area >= minimumDetectedArea
  }

  static func ordered(_ points: [CGPoint]) -> PageQuad? {
    guard points.count == cornerCount, points.allSatisfy({ $0.x.isFinite && $0.y.isFinite }) else {
      return nil
    }
    let centerX = points.map(\.x).reduce(0, +) / CGFloat(cornerCount)
    let centerY = points.map(\.y).reduce(0, +) / CGFloat(cornerCount)
    let clockwise = points.sorted { atan2($0.y - centerY, $0.x - centerX) < atan2($1.y - centerY, $1.x - centerX) }
    let start = clockwise.indices.min { first, second in
      let firstSum = clockwise[first].x + clockwise[first].y
      let secondSum = clockwise[second].x + clockwise[second].y
      return firstSum == secondSum ? clockwise[first].y < clockwise[second].y : firstSum < secondSum
    } ?? 0
    let rotated = Array(clockwise[start...] + clockwise[..<start])
    return PageQuad(topLeft: rotated[0], topRight: rotated[1], bottomRight: rotated[2], bottomLeft: rotated[3])
  }

  // CAP-018-R10
  static func manual(_ points: [CGPoint]) -> PageQuad? {
    guard points.allSatisfy({ $0.x.isFinite && $0.y.isFinite }) else {
      return nil
    }
    let clamped = points.map { CGPoint(x: min(max($0.x, 0), 1), y: min(max($0.y, 0), 1)) }
    guard let quad = ordered(clamped), quad.isConvex, quad.area >= minimumManualArea else {
      return nil
    }
    return quad
  }

  static func fromVision(topLeft: CGPoint, topRight: CGPoint, bottomRight: CGPoint, bottomLeft: CGPoint) -> PageQuad? {
    ordered([topLeft, topRight, bottomRight, bottomLeft].map { CGPoint(x: $0.x, y: 1 - $0.y) })
  }

  func maximumDistance(to other: PageQuad) -> Double {
    zip(corners, other.corners).map { Double(hypot($0.x - $1.x, $0.y - $1.y)) }.max() ?? 0
  }

  func interpolated(toward target: PageQuad, by fraction: Double) -> PageQuad {
    let points = zip(corners, target.corners).map { current, goal in
      CGPoint(
        x: current.x + (goal.x - current.x) * CGFloat(fraction), y: current.y + (goal.y - current.y) * CGFloat(fraction))
    }
    return PageQuad(topLeft: points[0], topRight: points[1], bottomRight: points[2], bottomLeft: points[3])
  }

  func mapped(_ transform: (CGPoint) -> CGPoint) -> PageQuad {
    PageQuad(
      topLeft: transform(topLeft), topRight: transform(topRight), bottomRight: transform(bottomRight),
      bottomLeft: transform(bottomLeft))
  }

  func coreImagePoints(in size: CGSize) -> PageQuad {
    mapped { CGPoint(x: $0.x * size.width, y: (1 - $0.y) * size.height) }
  }

  func layerPoints(frame: CGSize, layer: CGSize) -> PageQuad {
    guard frame.width > 0, frame.height > 0 else {
      return self
    }
    let scale = max(layer.width / frame.width, layer.height / frame.height)
    let drawnWidth = frame.width * scale
    let drawnHeight = frame.height * scale
    let offsetX = (layer.width - drawnWidth) / 2
    let offsetY = (layer.height - drawnHeight) / 2
    return mapped { CGPoint(x: offsetX + $0.x * drawnWidth, y: offsetY + $0.y * drawnHeight) }
  }

  func converted(from source: CGSize, to target: CGSize) -> PageQuad {
    guard source.width > 0, source.height > 0, target.width > 0, target.height > 0 else {
      return self
    }
    let sourceAspect = source.width / source.height
    let targetAspect = target.width / target.height
    let width = sourceAspect < targetAspect ? sourceAspect / targetAspect : 1
    let height = sourceAspect > targetAspect ? targetAspect / sourceAspect : 1
    let originX = (1 - width) / 2
    let originY = (1 - height) / 2
    return mapped { CGPoint(x: originX + $0.x * width, y: originY + $0.y * height) }
  }
}

enum PageGeometry {
  static let portraitRotationAngle: Double = 90
  static let portraitVisionOrientation = CGImagePropertyOrientation.right

  static func portraitSize(width: Int, height: Int) -> CGSize {
    CGSize(width: height, height: width)
  }

  // CAP-015-R34, CAP-018-R11
  static func clockwiseOrientation(quarterTurns: Int) -> CGImagePropertyOrientation {
    switch ((quarterTurns % turnsPerCircle) + turnsPerCircle) % turnsPerCircle {
    case 1:
      return .right
    case 2:
      return .down
    case 3:
      return .left
    default:
      return .up
    }
  }

  // CAP-018-R02
  static func photoDimensions(supported: [(width: Int, height: Int)]) -> (width: Int, height: Int)? {
    let fewerPixels: ((width: Int, height: Int), (width: Int, height: Int)) -> Bool = {
      $0.width * $0.height < $1.width * $1.height
    }
    let fitting = supported.filter { $0.width * $0.height <= largestPhotoPixels }
    return fitting.max(by: fewerPixels) ?? supported.min(by: fewerPixels)
  }
}

// CAP-018-R02
struct EdgeTracker {
  static let steadyFrames = 4
  static let lostFrames = 4
  static let steadyTolerance = 0.02
  static let snapDistance = 0.1
  static let smoothing = 0.5

  private(set) var quad: PageQuad?
  private(set) var isFound = false
  private var lastDetected: PageQuad?
  private var steadyCount = 0
  private var missCount = 0

  mutating func track(_ detected: PageQuad?) {
    guard let detected else {
      miss()
      return
    }
    missCount = 0
    let isSteady = lastDetected.map { $0.maximumDistance(to: detected) <= EdgeTracker.steadyTolerance } ?? false
    steadyCount = isSteady ? steadyCount + 1 : 1
    lastDetected = detected
    quad = smoothed(toward: detected)
    if steadyCount >= EdgeTracker.steadyFrames {
      isFound = true
    }
  }

  mutating func reset() {
    self = EdgeTracker()
  }

  private func smoothed(toward detected: PageQuad) -> PageQuad {
    guard let quad, quad.maximumDistance(to: detected) < EdgeTracker.snapDistance else {
      return detected
    }
    return quad.interpolated(toward: detected, by: EdgeTracker.smoothing)
  }

  private mutating func miss() {
    missCount += 1
    guard missCount >= EdgeTracker.lostFrames else {
      return
    }
    reset()
  }
}
