package cz.veevoy.ansora.core.mobile

// Exif 2.3 Orientation
internal enum class ExifOrientation(val value: Int) {
  TOP_LEFT(1),
  TOP_RIGHT(2),
  BOTTOM_RIGHT(3),
  BOTTOM_LEFT(4),
  LEFT_TOP(5),
  RIGHT_TOP(6),
  RIGHT_BOTTOM(7),
  LEFT_BOTTOM(8);

  companion object {
    fun of(value: Int): ExifOrientation? = values().firstOrNull { it.value == value }
  }
}

// CAP-015-R14, Q-068, Q-085
internal object JpegMetadata {
  private val JFIF_IDENTIFIER = "JFIF\u0000".toByteArray(Charsets.US_ASCII)

  // ITU-T T.871 10.1
  private const val JFIF_HEADER_BYTES = 14
  private const val JFIF_THUMBNAIL_SIZE_OFFSET = 12
  private val NO_THUMBNAIL = byteArrayOf(0, 0)

  private val EXIF_IDENTIFIER = "Exif\u0000\u0000".toByteArray(Charsets.US_ASCII)
  private val ICC_IDENTIFIER = "ICC_PROFILE\u0000".toByteArray(Charsets.US_ASCII)
  private val ADOBE_IDENTIFIER = "Adobe".toByteArray(Charsets.US_ASCII)
  private const val BIG_ENDIAN_MARK = 0x4D4D
  private const val LITTLE_ENDIAN_MARK = 0x4949
  private const val TIFF_MAGIC = 42
  private const val ORIENTATION_TAG = 0x0112
  private const val SHORT_TYPE = 3
  private const val IFD_ENTRY_BYTES = 12

  // Exif 2.3, TIFF 6.0
  private val UPRIGHT_EXIF = EXIF_IDENTIFIER + byteArrayOf(
    0x4D, 0x4D, 0x00, 0x2A, 0x00, 0x00, 0x00, 0x08,
    0x00, 0x01,
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
  )

  fun orientation(file: JpegFile): ExifOrientation =
    file.segments.filter { it.marker == JpegMarker.EXIF }.firstNotNullOfOrNull { orientationInExif(it.payload) }
      ?: ExifOrientation.TOP_LEFT

  fun isKept(segment: JpegSegment): Boolean = when (segment.marker) {
    JpegMarker.JFIF -> segment.payload.startsWith(JFIF_IDENTIFIER) && segment.payload.size >= JFIF_HEADER_BYTES
    JpegMarker.ICC_PROFILE -> segment.payload.startsWith(ICC_IDENTIFIER)
    JpegMarker.ADOBE -> segment.payload.startsWith(ADOBE_IDENTIFIER)
    else -> false
  }

  fun isMetadata(segment: JpegSegment): Boolean =
    segment.marker in JpegMarker.APPLICATIONS || segment.marker == JpegMarker.COMMENT

  fun keptHeader(file: JpegFile): List<JpegSegment> = file.segments.filter(::isKept).map(::withoutThumbnail)

  fun cleanedHeader(file: JpegFile): List<JpegSegment> {
    val kept = keptHeader(file)
    val leading = kept.filter { it.marker == JpegMarker.JFIF }
    val trailing = kept.filter { it.marker != JpegMarker.JFIF }
    return leading + JpegSegment(JpegMarker.EXIF, UPRIGHT_EXIF) + trailing
  }

  // ITU-T T.871 10.1
  private fun withoutThumbnail(segment: JpegSegment): JpegSegment {
    if (segment.marker != JpegMarker.JFIF) {
      return segment
    }
    return JpegSegment(segment.marker, segment.payload.copyOfRange(0, JFIF_THUMBNAIL_SIZE_OFFSET) + NO_THUMBNAIL)
  }

  private fun orientationInExif(payload: ByteArray): ExifOrientation? {
    if (!payload.startsWith(EXIF_IDENTIFIER)) {
      return null
    }
    val tiff = payload.copyOfRange(EXIF_IDENTIFIER.size, payload.size)
    if (tiff.size < 8) {
      return null
    }
    val mark = tiff.unsigned(0) shl 8 or tiff.unsigned(1)
    val reader = when (mark) {
      BIG_ENDIAN_MARK -> TiffReader(tiff, isBigEndian = true)
      LITTLE_ENDIAN_MARK -> TiffReader(tiff, isBigEndian = false)
      else -> return null
    }
    if (reader.short(2) != TIFF_MAGIC) {
      return null
    }
    val ifd = reader.long(4) ?: return null
    val entries = reader.short(ifd) ?: return null
    for (index in 0 until entries) {
      val entry = ifd + 2 + index * IFD_ENTRY_BYTES
      if (reader.short(entry) != ORIENTATION_TAG) {
        continue
      }
      if (reader.short(entry + 2) != SHORT_TYPE) {
        return null
      }
      val value = reader.short(entry + 8) ?: return null
      return ExifOrientation.of(value)
    }
    return null
  }

  private fun ByteArray.startsWith(prefix: ByteArray): Boolean =
    size >= prefix.size && prefix.indices.all { this[it] == prefix[it] }

  private class TiffReader(private val bytes: ByteArray, private val isBigEndian: Boolean) {
    fun short(offset: Int): Int? {
      if (offset < 0 || offset > bytes.size - 2) {
        return null
      }
      val first = bytes.unsigned(offset)
      val second = bytes.unsigned(offset + 1)
      return if (isBigEndian) first shl 8 or second else second shl 8 or first
    }

    fun long(offset: Int): Int? {
      val high = short(if (isBigEndian) offset else offset + 2) ?: return null
      val low = short(if (isBigEndian) offset + 2 else offset) ?: return null
      return high shl 16 or low
    }
  }
}
