package cz.veevoy.ansora.core.mobile

private const val QUARTER_TURNS_PER_TURN = 4

internal enum class FlipAxis { HORIZONTAL, VERTICAL }

// IJG transupp.c

// Exif 2.3 Orientation
internal fun CoefficientImage.upright(orientation: ExifOrientation): CoefficientImage = when (orientation) {
  ExifOrientation.TOP_LEFT -> this
  ExifOrientation.TOP_RIGHT -> flipped(FlipAxis.HORIZONTAL)
  ExifOrientation.BOTTOM_RIGHT -> flipped(FlipAxis.HORIZONTAL).flipped(FlipAxis.VERTICAL)
  ExifOrientation.BOTTOM_LEFT -> flipped(FlipAxis.VERTICAL)
  ExifOrientation.LEFT_TOP -> transposed()
  ExifOrientation.RIGHT_TOP -> transposed().flipped(FlipAxis.HORIZONTAL)
  ExifOrientation.RIGHT_BOTTOM -> transposed().flipped(FlipAxis.HORIZONTAL).flipped(FlipAxis.VERTICAL)
  ExifOrientation.LEFT_BOTTOM -> transposed().flipped(FlipAxis.VERTICAL)
}

internal fun CoefficientImage.rotatedClockwise(quarterTurns: Int): CoefficientImage =
  when (Math.floorMod(quarterTurns, QUARTER_TURNS_PER_TURN)) {
    1 -> transposed().flipped(FlipAxis.HORIZONTAL)
    2 -> flipped(FlipAxis.HORIZONTAL).flipped(FlipAxis.VERTICAL)
    3 -> transposed().flipped(FlipAxis.VERTICAL)
    else -> this
  }

internal fun CoefficientImage.transposed(): CoefficientImage {
  val planes = components.map { plane ->
    val coefficients = ShortArray(plane.coefficients.size)
    val turned = plane.reshaped(plane.vertical, plane.horizontal, plane.blocksHigh, plane.blocksWide, coefficients)
    for (y in 0 until plane.blocksHigh) {
      for (x in 0 until plane.blocksWide) {
        val source = plane.blockIndex(x, y)
        val target = turned.blockIndex(y, x)
        for (row in 0 until JPEG_BLOCK_SIDE) {
          for (column in 0 until JPEG_BLOCK_SIDE) {
            coefficients[target + column * JPEG_BLOCK_SIDE + row] = plane.coefficients[source + row * JPEG_BLOCK_SIDE + column]
          }
        }
      }
    }
    turned
  }
  return CoefficientImage(height, width, planes, quantizationTables.map { it?.let(::transposedBlock) }.toTypedArray())
}

// jpegtran -trim
internal fun CoefficientImage.flipped(axis: FlipAxis): CoefficientImage {
  val isHorizontal = axis == FlipAxis.HORIZONTAL
  val whole = if (isHorizontal) trimmed(width - width % mcuWidth, height) else trimmed(width, height - height % mcuHeight)
  val planes = whole.components.map { plane ->
    val coefficients = ShortArray(plane.coefficients.size)
    for (y in 0 until plane.blocksHigh) {
      for (x in 0 until plane.blocksWide) {
        val source = plane.blockIndex(x, y)
        val target = if (isHorizontal) {
          plane.blockIndex(plane.blocksWide - 1 - x, y)
        } else {
          plane.blockIndex(x, plane.blocksHigh - 1 - y)
        }
        for (row in 0 until JPEG_BLOCK_SIDE) {
          for (column in 0 until JPEG_BLOCK_SIDE) {
            val value = plane.coefficients[source + row * JPEG_BLOCK_SIDE + column]
            val isOddFrequency = (if (isHorizontal) column else row) % 2 == 1
            coefficients[target + row * JPEG_BLOCK_SIDE + column] = if (isOddFrequency) (-value).toShort() else value
          }
        }
      }
    }
    plane.reshaped(plane.horizontal, plane.vertical, plane.blocksWide, plane.blocksHigh, coefficients)
  }
  return CoefficientImage(whole.width, whole.height, planes, whole.quantizationTables)
}

// CAP-015-R03
internal fun CoefficientImage.cropped(x: Int, y: Int, newWidth: Int, newHeight: Int): CoefficientImage {
  val mcusWide = (newWidth + mcuWidth - 1) / mcuWidth
  val mcusHigh = (newHeight + mcuHeight - 1) / mcuHeight
  val planes = components.map { plane ->
    val blocksWide = mcusWide * plane.horizontal
    val blocksHigh = mcusHigh * plane.vertical
    val coefficients = ShortArray(blocksWide * blocksHigh * JPEG_BLOCK_SIZE)
    val cut = plane.reshaped(plane.horizontal, plane.vertical, blocksWide, blocksHigh, coefficients)
    val offsetX = x / mcuWidth * plane.horizontal
    val offsetY = y / mcuHeight * plane.vertical
    for (row in 0 until blocksHigh) {
      if (offsetY + row >= plane.blocksHigh) {
        break
      }
      for (column in 0 until blocksWide) {
        if (offsetX + column >= plane.blocksWide) {
          break
        }
        val source = plane.blockIndex(offsetX + column, offsetY + row)
        plane.coefficients.copyInto(coefficients, cut.blockIndex(column, row), source, source + JPEG_BLOCK_SIZE)
      }
    }
    cut
  }
  return CoefficientImage(newWidth, newHeight, planes, quantizationTables)
}

private fun CoefficientImage.trimmed(newWidth: Int, newHeight: Int): CoefficientImage {
  if (newWidth == width && newHeight == height) {
    return this
  }
  return cropped(0, 0, maxOf(newWidth, mcuWidth), maxOf(newHeight, mcuHeight))
}

private fun transposedBlock(table: IntArray): IntArray {
  val transposed = table.copyOf()
  for (row in 0 until JPEG_BLOCK_SIDE) {
    for (column in 0 until JPEG_BLOCK_SIDE) {
      transposed[column * JPEG_BLOCK_SIDE + row] = table[row * JPEG_BLOCK_SIDE + column]
    }
  }
  return transposed
}
