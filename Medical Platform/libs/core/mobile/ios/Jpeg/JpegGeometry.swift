import Foundation

enum FlipAxis {
  case horizontal
  case vertical
}

private let quarterTurnsPerTurn = 4

// IJG transupp.c
extension CoefficientImage {
  // Exif 2.3 Orientation
  func upright(from orientation: ExifOrientation) -> CoefficientImage {
    switch orientation {
    case .topLeft:
      return self
    case .topRight:
      return flipped(.horizontal)
    case .bottomRight:
      return flipped(.horizontal).flipped(.vertical)
    case .bottomLeft:
      return flipped(.vertical)
    case .leftTop:
      return transposed()
    case .rightTop:
      return transposed().flipped(.horizontal)
    case .rightBottom:
      return transposed().flipped(.horizontal).flipped(.vertical)
    case .leftBottom:
      return transposed().flipped(.vertical)
    }
  }

  func rotatedClockwise(quarterTurns: Int) -> CoefficientImage {
    switch ((quarterTurns % quarterTurnsPerTurn) + quarterTurnsPerTurn) % quarterTurnsPerTurn {
    case 1:
      return transposed().flipped(.horizontal)
    case 2:
      return flipped(.horizontal).flipped(.vertical)
    case 3:
      return transposed().flipped(.vertical)
    default:
      return self
    }
  }

  func transposed() -> CoefficientImage {
    var result = self
    result.width = height
    result.height = width
    result.quantizationTables = quantizationTables.map { $0.map(CoefficientImage.transposedBlock) }
    result.components = components.map { plane in
      var turned = plane
      turned.horizontal = plane.vertical
      turned.vertical = plane.horizontal
      turned.blocksWide = plane.blocksHigh
      turned.blocksHigh = plane.blocksWide
      var coefficients = [Int16](repeating: 0, count: plane.coefficients.count)
      for y in 0..<plane.blocksHigh {
        for x in 0..<plane.blocksWide {
          let source = plane.blockIndex(x: x, y: y)
          let target = turned.blockIndex(x: y, y: x)
          for row in 0..<jpegBlockSide {
            for column in 0..<jpegBlockSide {
              coefficients[target + column * jpegBlockSide + row] = plane.coefficients[source + row * jpegBlockSide + column]
            }
          }
        }
      }
      turned.coefficients = coefficients
      return turned
    }
    return result
  }

  // jpegtran -trim
  func flipped(_ axis: FlipAxis) -> CoefficientImage {
    let isHorizontal = axis == .horizontal
    let whole =
      isHorizontal
      ? trimmed(width: width - width % mcuWidth, height: height)
      : trimmed(width: width, height: height - height % mcuHeight)
    var result = whole
    result.components = whole.components.map { plane in
      var flipped = plane
      for y in 0..<plane.blocksHigh {
        for x in 0..<plane.blocksWide {
          let source = plane.blockIndex(x: x, y: y)
          let target =
            isHorizontal
            ? plane.blockIndex(x: plane.blocksWide - 1 - x, y: y)
            : plane.blockIndex(x: x, y: plane.blocksHigh - 1 - y)
          for row in 0..<jpegBlockSide {
            for column in 0..<jpegBlockSide {
              let value = plane.coefficients[source + row * jpegBlockSide + column]
              let isOddFrequency = (isHorizontal ? column : row) % 2 == 1
              flipped.coefficients[target + row * jpegBlockSide + column] = isOddFrequency ? -value : value
            }
          }
        }
      }
      return flipped
    }
    return result
  }

  // CAP-015-R03
  func cropped(x: Int, y: Int, width newWidth: Int, height newHeight: Int) -> CoefficientImage {
    var result = self
    result.width = newWidth
    result.height = newHeight
    let mcusWide = (newWidth + mcuWidth - 1) / mcuWidth
    let mcusHigh = (newHeight + mcuHeight - 1) / mcuHeight
    result.components = components.map { plane in
      var cut = plane
      cut.blocksWide = mcusWide * plane.horizontal
      cut.blocksHigh = mcusHigh * plane.vertical
      cut.coefficients = [Int16](repeating: 0, count: cut.blocksWide * cut.blocksHigh * jpegBlockSize)
      let offsetX = x / mcuWidth * plane.horizontal
      let offsetY = y / mcuHeight * plane.vertical
      for row in 0..<cut.blocksHigh where offsetY + row < plane.blocksHigh {
        for column in 0..<cut.blocksWide where offsetX + column < plane.blocksWide {
          let source = plane.blockIndex(x: offsetX + column, y: offsetY + row)
          let target = cut.blockIndex(x: column, y: row)
          cut.coefficients.replaceSubrange(
            target..<(target + jpegBlockSize), with: plane.coefficients[source..<(source + jpegBlockSize)])
        }
      }
      return cut
    }
    return result
  }

  private func trimmed(width newWidth: Int, height newHeight: Int) -> CoefficientImage {
    guard newWidth != width || newHeight != height else {
      return self
    }
    return cropped(x: 0, y: 0, width: max(newWidth, mcuWidth), height: max(newHeight, mcuHeight))
  }

  private static func transposedBlock(_ table: [UInt16]) -> [UInt16] {
    var transposed = table
    for row in 0..<jpegBlockSide {
      for column in 0..<jpegBlockSide {
        transposed[column * jpegBlockSide + row] = table[row * jpegBlockSide + column]
      }
    }
    return transposed
  }
}
