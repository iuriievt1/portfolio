package cz.veevoy.ansora.core.mobile

import java.io.ByteArrayOutputStream

internal class JpegMalformedException : Exception("The JPEG stream is malformed")

internal class JpegUnsupportedException : Exception("The JPEG stream is not baseline")

internal object JpegMarker {
  const val PREFIX = 0xFF
  const val STUFFING = 0x00
  const val START_OF_IMAGE = 0xD8
  const val END_OF_IMAGE = 0xD9
  const val START_OF_SCAN = 0xDA
  const val QUANTIZATION_TABLES = 0xDB
  const val HUFFMAN_TABLES = 0xC4
  const val RESTART_INTERVAL = 0xDD
  const val BASELINE_FRAME = 0xC0
  const val JFIF = 0xE0
  const val EXIF = 0xE1
  const val ICC_PROFILE = 0xE2
  const val ADOBE = 0xEE
  const val COMMENT = 0xFE
  val RESTARTS = 0xD0..0xD7
  val APPLICATIONS = 0xE0..0xEF
  val FRAMES = setOf(0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF)
}

internal class JpegSegment(val marker: Int, val payload: ByteArray)

internal class JpegScan(val header: ByteArray, val entropyData: ByteArray)

internal sealed interface JpegPart {
  class Segment(val segment: JpegSegment) : JpegPart

  class Scan(val scan: JpegScan) : JpegPart
}

internal fun ByteArray.unsigned(index: Int): Int = this[index].toInt() and 0xFF

internal class JpegFile(val parts: List<JpegPart>) {
  val segments: List<JpegSegment>
    get() = parts.filterIsInstance<JpegPart.Segment>().map { it.segment }

  val frameMarker: Int?
    get() = segments.firstOrNull { it.marker in JpegMarker.FRAMES }?.marker

  fun serialized(): ByteArray {
    val output = ByteArrayOutputStream()
    output.write(JpegMarker.PREFIX)
    output.write(JpegMarker.START_OF_IMAGE)
    for (part in parts) {
      when (part) {
        is JpegPart.Segment -> append(part.segment.marker, part.segment.payload, output)
        is JpegPart.Scan -> {
          append(JpegMarker.START_OF_SCAN, part.scan.header, output)
          output.write(part.scan.entropyData)
        }
      }
    }
    output.write(JpegMarker.PREFIX)
    output.write(JpegMarker.END_OF_IMAGE)
    return output.toByteArray()
  }

  private fun append(marker: Int, payload: ByteArray, output: ByteArrayOutputStream) {
    val length = payload.size + LENGTH_BYTES
    if (length > MAXIMUM_SEGMENT_LENGTH) {
      throw JpegMalformedException()
    }
    output.write(JpegMarker.PREFIX)
    output.write(marker)
    output.write(length shr 8)
    output.write(length and 0xFF)
    output.write(payload)
  }

  companion object {
    private const val LENGTH_BYTES = 2
    private const val MAXIMUM_SEGMENT_LENGTH = 0xFFFF

    // ITU-T T.81 B.1.1
    fun parse(bytes: ByteArray): JpegFile {
      if (bytes.size <= 3 || bytes.unsigned(0) != JpegMarker.PREFIX || bytes.unsigned(1) != JpegMarker.START_OF_IMAGE) {
        throw JpegMalformedException()
      }
      val parts = mutableListOf<JpegPart>()
      var position = 2
      while (true) {
        if (position >= bytes.size || bytes.unsigned(position) != JpegMarker.PREFIX) {
          throw JpegMalformedException()
        }
        while (position < bytes.size && bytes.unsigned(position) == JpegMarker.PREFIX) {
          position += 1
        }
        if (position >= bytes.size) {
          throw JpegMalformedException()
        }
        val marker = bytes.unsigned(position)
        position += 1
        if (marker == JpegMarker.END_OF_IMAGE) {
          return JpegFile(parts)
        }
        if (position + LENGTH_BYTES > bytes.size) {
          throw JpegMalformedException()
        }
        val length = bytes.unsigned(position) shl 8 or bytes.unsigned(position + 1)
        if (length < LENGTH_BYTES || position + length > bytes.size) {
          throw JpegMalformedException()
        }
        val payload = bytes.copyOfRange(position + LENGTH_BYTES, position + length)
        position += length
        if (marker != JpegMarker.START_OF_SCAN) {
          parts.add(JpegPart.Segment(JpegSegment(marker, payload)))
          continue
        }
        val end = entropyDataEnd(bytes, position)
        parts.add(JpegPart.Scan(JpegScan(payload, bytes.copyOfRange(position, end))))
        position = end
      }
    }

    // ITU-T T.81 B.1.1.5
    private fun entropyDataEnd(bytes: ByteArray, start: Int): Int {
      var position = start
      while (position + 1 < bytes.size) {
        if (bytes.unsigned(position) != JpegMarker.PREFIX) {
          position += 1
          continue
        }
        val next = bytes.unsigned(position + 1)
        if (next == JpegMarker.STUFFING || next in JpegMarker.RESTARTS) {
          position += 2
          continue
        }
        return position
      }
      throw JpegMalformedException()
    }
  }
}
