package cz.veevoy.ansora.core.mobile

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint
import android.util.Base64
import java.io.ByteArrayOutputStream
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

// CAP-018-R03
private const val PAGE_QUALITY = 90
private const val SHARPNESS = 0.4
private const val CONTRAST = 1.1
// NAB-193
private const val PAPER_MAP_LONGER_SIDE = 64
private const val PAPER_MAP_SPREAD = 2
private const val DARKEST_PAPER = 48
private const val LARGEST_GAIN = 2.5
// CAP-018-R02
private const val PREVIEW_LONGER_SIDE = 512
private const val PREVIEW_QUALITY = 70
private const val DETECTION_LONGER_SIDE = 640
private const val AIMED_PAGE_TOLERANCE = 0.1
private const val CHANNEL_MAX = 255
private const val MIDDLE_GRAY = 128.0
private const val QUARTER_TURN_DEGREES = 90f
private const val RED_WEIGHT = 299
private const val GREEN_WEIGHT = 587
private const val BLUE_WEIGHT = 114
private const val WEIGHT_TOTAL = 1000

// NAB-192–194, CAP-018-R03, CAP-018-R04, CAP-018-R10
internal object PageImaging {
  fun decoded(jpeg: ByteArray): Bitmap {
    val options = BitmapFactory.Options().apply {
      inPreferredConfig = Bitmap.Config.ARGB_8888
      inMutable = true
    }
    return BitmapFactory.decodeByteArray(jpeg, 0, jpeg.size, options) ?: throw PhotoUnreadableException()
  }

  // CAP-018-R02
  fun pageEdges(image: Bitmap, preview: PreviewEdges?): PageQuad? {
    val detected = PageDetection.page(luminance(image))
    val aimed = preview?.let { it.quad.converted(it.frame, sizeOf(image)) } ?: return detected
    if (detected != null && detected.maximumDistance(aimed) <= AIMED_PAGE_TOLERANCE) {
      return detected
    }
    return aimed
  }

  // CAP-018-R03, CAP-018-R10, CAP-018-R11
  fun page(image: Bitmap, edges: PageQuad?, quarterTurns: Int): PreparedJpeg {
    val straightened = edges?.let { perspectiveCorrected(image, it) } ?: image
    if (straightened !== image) {
      image.recycle()
    }
    val turned = rotated(straightened, quarterTurns)
    if (turned !== straightened) {
      straightened.recycle()
    }
    try {
      enhance(turned)
      sharpen(turned)
      return encoded(turned, PAGE_QUALITY)
    } finally {
      turned.recycle()
    }
  }

  // CAP-018-R02, CAP-018-R03
  fun preview(photo: ByteArray, edges: PreviewEdges?): String {
    val small = decodedFitting(photo, PREVIEW_LONGER_SIDE)
    val quad = edges?.quad?.converted(edges.frame, sizeOf(small))
    val straightened = quad?.let { perspectiveCorrected(small, it) } ?: small
    if (straightened !== small) {
      small.recycle()
    }
    try {
      enhance(straightened)
      return Base64.encodeToString(encoded(straightened, PREVIEW_QUALITY).bytes, Base64.NO_WRAP)
    } finally {
      straightened.recycle()
    }
  }

  private fun sizeOf(image: Bitmap): PageSize = PageSize(image.width.toDouble(), image.height.toDouble())

  private fun luminance(image: Bitmap): Luminance {
    val scale = min(1.0, DETECTION_LONGER_SIDE.toDouble() / max(image.width, image.height))
    val width = max(1, (image.width * scale).roundToInt())
    val height = max(1, (image.height * scale).roundToInt())
    val small = if (scale < 1.0) Bitmap.createScaledBitmap(image, width, height, true) else image
    val pixels = IntArray(width * height)
    small.getPixels(pixels, 0, width, 0, 0, width, height)
    if (small !== image) {
      small.recycle()
    }
    return Luminance(width, height, IntArray(pixels.size) { lumaOf(pixels[it]) })
  }

  private fun decodedFitting(jpeg: ByteArray, longerSide: Int): Bitmap {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeByteArray(jpeg, 0, jpeg.size, bounds)
    val longer = max(bounds.outWidth, bounds.outHeight)
    if (longer <= 0) {
      throw PhotoUnreadableException()
    }
    var sample = 1
    while (longer / (sample * 2) >= longerSide) {
      sample *= 2
    }
    val options = BitmapFactory.Options().apply {
      inSampleSize = sample
      inPreferredConfig = Bitmap.Config.ARGB_8888
      inMutable = true
    }
    val decoded = BitmapFactory.decodeByteArray(jpeg, 0, jpeg.size, options) ?: throw PhotoUnreadableException()
    val scale = longerSide.toDouble() / max(decoded.width, decoded.height)
    if (scale >= 1.0) {
      return decoded
    }
    val scaled = Bitmap.createScaledBitmap(
      decoded,
      max(1, (decoded.width * scale).roundToInt()),
      max(1, (decoded.height * scale).roundToInt()),
      true,
    ).copy(Bitmap.Config.ARGB_8888, true)
    decoded.recycle()
    return scaled
  }

  private fun perspectiveCorrected(image: Bitmap, edges: PageQuad): Bitmap {
    val corners = edges.scaled(sizeOf(image)).corners
    val width = max(corners[0].distance(corners[1]), corners[3].distance(corners[2])).roundToInt()
    val height = max(corners[0].distance(corners[3]), corners[1].distance(corners[2])).roundToInt()
    if (width <= 0 || height <= 0) {
      throw PhotoUnreadableException()
    }
    val source = corners.flatMap { listOf(it.x.toFloat(), it.y.toFloat()) }.toFloatArray()
    val target = floatArrayOf(0f, 0f, width.toFloat(), 0f, width.toFloat(), height.toFloat(), 0f, height.toFloat())
    val matrix = Matrix()
    if (!matrix.setPolyToPoly(source, 0, target, 0, corners.size)) {
      throw PhotoUnreadableException()
    }
    val result = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    Canvas(result).drawBitmap(image, matrix, Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG))
    return result
  }

  // CAP-018-R11
  private fun rotated(image: Bitmap, quarterTurns: Int): Bitmap {
    val turns = PageGeometry.normalizedTurns(quarterTurns)
    if (turns == 0) {
      return image
    }
    val isSideways = turns % 2 == 1
    val width = if (isSideways) image.height else image.width
    val height = if (isSideways) image.width else image.height
    val matrix = Matrix().apply {
      setRotate(turns * QUARTER_TURN_DEGREES)
      when (turns) {
        1 -> postTranslate(image.height.toFloat(), 0f)
        2 -> postTranslate(image.width.toFloat(), image.height.toFloat())
        else -> postTranslate(0f, image.width.toFloat())
      }
    }
    val result = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    Canvas(result).drawBitmap(image, matrix, Paint(Paint.FILTER_BITMAP_FLAG))
    return result
  }

  // NAB-193
  private fun enhance(image: Bitmap) {
    val width = image.width
    val height = image.height
    val pixels = IntArray(width * height)
    image.getPixels(pixels, 0, width, 0, 0, width, height)
    val paper = PaperBrightness.of(pixels, width, height)
    for (y in 0 until height) {
      for (x in 0 until width) {
        val index = y * width + x
        val gain = min(LARGEST_GAIN, CHANNEL_MAX.toDouble() / max(paper.at(x, y), DARKEST_PAPER.toDouble()))
        pixels[index] = mapped(pixels[index]) { channel -> (channel * gain - MIDDLE_GRAY) * CONTRAST + MIDDLE_GRAY }
      }
    }
    image.setPixels(pixels, 0, width, 0, 0, width, height)
  }

  // NAB-194
  private fun sharpen(image: Bitmap) {
    val width = image.width
    val height = image.height
    val pixels = IntArray(width * height)
    image.getPixels(pixels, 0, width, 0, 0, width, height)
    val luma = ByteArray(pixels.size) { lumaOf(pixels[it]).toByte() }
    for (y in 0 until height) {
      for (x in 0 until width) {
        var sum = 0
        for (dy in -1..1) {
          val row = (y + dy).coerceIn(0, height - 1) * width
          for (dx in -1..1) {
            sum += luma[row + (x + dx).coerceIn(0, width - 1)].toInt() and 0xFF
          }
        }
        val index = y * width + x
        val detail = SHARPNESS * ((luma[index].toInt() and 0xFF) - sum / 9.0)
        pixels[index] = mapped(pixels[index]) { channel -> channel + detail }
      }
    }
    image.setPixels(pixels, 0, width, 0, 0, width, height)
  }

  // mobilni-aplikace.md 4.1, CAP-015-R14
  private fun encoded(image: Bitmap, quality: Int): PreparedJpeg {
    val output = ByteArrayOutputStream()
    if (!image.compress(Bitmap.CompressFormat.JPEG, quality, output)) {
      throw PhotoUnreadableException()
    }
    return PreparedJpeg(output.toByteArray(), image.width, image.height)
  }

  private inline fun mapped(pixel: Int, channel: (Int) -> Double): Int {
    val red = channel(pixel shr 16 and 0xFF).roundToInt().coerceIn(0, CHANNEL_MAX)
    val green = channel(pixel shr 8 and 0xFF).roundToInt().coerceIn(0, CHANNEL_MAX)
    val blue = channel(pixel and 0xFF).roundToInt().coerceIn(0, CHANNEL_MAX)
    return (pixel and 0xFF000000.toInt()) or (red shl 16) or (green shl 8) or blue
  }

  fun lumaOf(pixel: Int): Int =
    ((pixel shr 16 and 0xFF) * RED_WEIGHT + (pixel shr 8 and 0xFF) * GREEN_WEIGHT + (pixel and 0xFF) * BLUE_WEIGHT) /
      WEIGHT_TOTAL

  private class PaperBrightness(private val map: IntArray, private val mapWidth: Int, private val mapHeight: Int, width: Int, height: Int) {
    private val stepX = mapWidth.toDouble() / width
    private val stepY = mapHeight.toDouble() / height

    fun at(x: Int, y: Int): Double {
      val mx = ((x + 0.5) * stepX - 0.5).coerceIn(0.0, (mapWidth - 1).toDouble())
      val my = ((y + 0.5) * stepY - 0.5).coerceIn(0.0, (mapHeight - 1).toDouble())
      val left = mx.toInt()
      val top = my.toInt()
      val right = min(left + 1, mapWidth - 1)
      val bottom = min(top + 1, mapHeight - 1)
      val fx = mx - left
      val fy = my - top
      val upper = map[top * mapWidth + left] * (1 - fx) + map[top * mapWidth + right] * fx
      val lower = map[bottom * mapWidth + left] * (1 - fx) + map[bottom * mapWidth + right] * fx
      return upper * (1 - fy) + lower * fy
    }

    companion object {
      fun of(pixels: IntArray, width: Int, height: Int): PaperBrightness {
        val scale = min(1.0, PAPER_MAP_LONGER_SIDE.toDouble() / max(width, height))
        val mapWidth = max(1, (width * scale).roundToInt())
        val mapHeight = max(1, (height * scale).roundToInt())
        val sums = LongArray(mapWidth * mapHeight)
        val counts = IntArray(mapWidth * mapHeight)
        for (y in 0 until height) {
          val my = min(mapHeight - 1, (y * scale).toInt())
          for (x in 0 until width) {
            val cell = my * mapWidth + min(mapWidth - 1, (x * scale).toInt())
            sums[cell] += lumaOf(pixels[y * width + x]).toLong()
            counts[cell] += 1
          }
        }
        var map = IntArray(sums.size) { if (counts[it] == 0) 0 else (sums[it] / counts[it]).toInt() }
        repeat(PAPER_MAP_SPREAD) { map = brightestAround(map, mapWidth, mapHeight) }
        return PaperBrightness(averagedAround(map, mapWidth, mapHeight), mapWidth, mapHeight, width, height)
      }

      private fun brightestAround(map: IntArray, width: Int, height: Int): IntArray =
        IntArray(map.size) { index -> neighbours(index, width, height).maxOf { map[it] } }

      private fun averagedAround(map: IntArray, width: Int, height: Int): IntArray =
        IntArray(map.size) { index -> neighbours(index, width, height).let { cells -> cells.sumOf { map[it] } / cells.size } }

      private fun neighbours(index: Int, width: Int, height: Int): List<Int> {
        val x = index % width
        val y = index / width
        val cells = ArrayList<Int>(9)
        for (dy in -1..1) {
          for (dx in -1..1) {
            val nx = x + dx
            val ny = y + dy
            if (nx in 0 until width && ny in 0 until height) {
              cells.add(ny * width + nx)
            }
          }
        }
        return cells
      }
    }
  }
}
