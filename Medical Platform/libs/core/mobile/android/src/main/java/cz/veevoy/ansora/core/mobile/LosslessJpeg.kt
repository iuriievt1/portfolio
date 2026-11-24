package cz.veevoy.ansora.core.mobile

import kotlin.math.roundToInt

internal class PreparedJpeg(val bytes: ByteArray, val width: Int, val height: Int)

internal class PixelRect(val x: Double, val y: Double, val width: Double, val height: Double)

// CAP-015-R14, CAP-015-R34, CAP-015-R03, Q-068, Q-131
internal object LosslessJpeg {
  // ITU-T T.81 B.2.2
  private const val FRAME_DIMENSIONS_BYTES = 5

  // CAP-015-R14, Q-068
  fun upright(bytes: ByteArray): PreparedJpeg {
    val file = JpegFile.parse(bytes)
    if (file.frameMarker != JpegMarker.BASELINE_FRAME) {
      throw JpegUnsupportedException()
    }
    val header = JpegMetadata.cleanedHeader(file)
    val orientation = JpegMetadata.orientation(file)
    if (orientation != ExifOrientation.TOP_LEFT) {
      val image = CoefficientImage.decode(file).upright(orientation)
      return PreparedJpeg(image.encoded(header), image.width, image.height)
    }
    val frame = file.segments.firstOrNull {
      it.marker == JpegMarker.BASELINE_FRAME && it.payload.size >= FRAME_DIMENSIONS_BYTES
    } ?: throw JpegMalformedException()
    val height = frame.payload.unsigned(1) shl 8 or frame.payload.unsigned(2)
    val width = frame.payload.unsigned(3) shl 8 or frame.payload.unsigned(4)
    return PreparedJpeg(replacingMetadata(file, header), width, height)
  }

  // mobilni-aplikace.md 4.1
  fun withoutMetadata(bytes: ByteArray): ByteArray {
    val file = JpegFile.parse(bytes)
    return replacingMetadata(file, JpegMetadata.keptHeader(file))
  }

  private fun replacingMetadata(file: JpegFile, header: List<JpegSegment>): ByteArray {
    val coding: List<JpegPart> = file.parts.filter { it !is JpegPart.Segment || !JpegMetadata.isMetadata(it.segment) }
    val parts: List<JpegPart> = header.map<JpegSegment, JpegPart> { JpegPart.Segment(it) } + coding
    return JpegFile(parts).serialized()
  }

  // CAP-015-R34
  fun rotatedClockwise(bytes: ByteArray, quarterTurns: Int): PreparedJpeg {
    val file = JpegFile.parse(bytes)
    val image = CoefficientImage.decode(file).rotatedClockwise(quarterTurns)
    return PreparedJpeg(image.encoded(JpegMetadata.cleanedHeader(file)), image.width, image.height)
  }

  // CAP-015-R34, CAP-015-R03
  fun cropped(bytes: ByteArray, rect: PixelRect): PreparedJpeg {
    val file = JpegFile.parse(bytes)
    val image = CoefficientImage.decode(file)
    val left = gridStart(rect.x, image.mcuWidth, image.width)
    val top = gridStart(rect.y, image.mcuHeight, image.height)
    val right = gridEnd(rect.x + rect.width, left, image.mcuWidth, image.width)
    val bottom = gridEnd(rect.y + rect.height, top, image.mcuHeight, image.height)
    val cut = image.cropped(left, top, right - left, bottom - top)
    return PreparedJpeg(cut.encoded(JpegMetadata.cleanedHeader(file)), cut.width, cut.height)
  }

  private fun gridStart(value: Double, step: Int, size: Int): Int {
    val last = maxOf(size - step, 0) / step * step
    return minOf(gridLine(value, step, size), last)
  }

  private fun gridEnd(value: Double, start: Int, step: Int, size: Int): Int =
    maxOf(gridLine(value, step, size), start + step).coerceAtMost(size)

  private fun gridLine(value: Double, step: Int, size: Int): Int {
    val steps = value / step
    if (steps.isNaN() || steps <= 0.0) {
      return 0
    }
    val stepsPastEdge = (size / step + 1).toDouble()
    return minOf(steps, stepsPastEdge).roundToInt() * step
  }
}
