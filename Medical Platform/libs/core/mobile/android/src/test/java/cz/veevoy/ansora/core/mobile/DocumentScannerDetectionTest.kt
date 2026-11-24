package cz.veevoy.ansora.core.mobile

import kotlin.random.Random
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

private const val WIDTH = 640
private const val HEIGHT = 480
private const val TABLE = 70
private const val PAPER = 225
private const val INK = 40
private const val CORNER_TOLERANCE = 0.03

private fun scene(paper: PageQuad?, noise: Int = 6, text: Boolean = true, seed: Int = 1): Luminance {
  val random = Random(seed)
  val values = IntArray(WIDTH * HEIGHT)
  val pixels = paper?.scaled(PageSize(WIDTH.toDouble(), HEIGHT.toDouble()))
  for (y in 0 until HEIGHT) {
    for (x in 0 until WIDTH) {
      val inside = pixels != null && contains(pixels, x + 0.5, y + 0.5)
      var value = if (inside) PAPER else TABLE
      if (inside && text && isTextLine(pixels!!, x + 0.5, y + 0.5)) {
        value = INK
      }
      values[y * WIDTH + x] = (value + random.nextInt(-noise, noise + 1)).coerceIn(0, 255)
    }
  }
  return Luminance(WIDTH, HEIGHT, values)
}

private fun contains(quad: PageQuad, x: Double, y: Double): Boolean {
  val corners = quad.corners
  return corners.indices.all { index ->
    val a = corners[index]
    val b = corners[(index + 1) % corners.size]
    (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x) >= 0
  }
}

private fun isTextLine(quad: PageQuad, x: Double, y: Double): Boolean {
  val top = (quad.topLeft.y + quad.topRight.y) / 2
  val bottom = (quad.bottomLeft.y + quad.bottomRight.y) / 2
  val left = (quad.topLeft.x + quad.bottomLeft.x) / 2
  val right = (quad.topRight.x + quad.bottomRight.x) / 2
  val margin = 0.15
  val v = (y - top) / (bottom - top)
  val u = (x - left) / (right - left)
  if (u < margin || u > 1 - margin || v < margin || v > 1 - margin) {
    return false
  }
  return ((v * 40).toInt() % 3 == 0) && ((u * 60).toInt() % 4 != 0)
}

private fun assertCorners(expected: PageQuad, actual: PageQuad?) {
  assertNotNull("no page found", actual)
  val distance = expected.maximumDistance(actual!!)
  assertTrue("corners off by $distance: $actual", distance <= CORNER_TOLERANCE)
}

class DocumentScannerDetectionTest {
  @Test
  fun `finds an upright page on a darker table`() {
    val page = PageQuad(PagePoint(0.2, 0.15), PagePoint(0.8, 0.15), PagePoint(0.8, 0.88), PagePoint(0.2, 0.88))

    assertCorners(page, PageDetection.page(scene(page)))
  }

  @Test
  fun `finds a page photographed at an angle`() {
    val page = PageQuad(PagePoint(0.28, 0.12), PagePoint(0.83, 0.2), PagePoint(0.74, 0.9), PagePoint(0.16, 0.8))

    assertCorners(page, PageDetection.page(scene(page, seed = 2)))
  }

  @Test
  fun `finds a page in perspective`() {
    val page = PageQuad(PagePoint(0.3, 0.1), PagePoint(0.7, 0.1), PagePoint(0.9, 0.92), PagePoint(0.1, 0.92))

    assertCorners(page, PageDetection.page(scene(page, seed = 3)))
  }

  @Test
  fun `finds a page through sensor noise`() {
    val page = PageQuad(PagePoint(0.18, 0.1), PagePoint(0.86, 0.14), PagePoint(0.82, 0.9), PagePoint(0.14, 0.86))

    assertCorners(page, PageDetection.page(scene(page, noise = 20, seed = 4)))
  }

  @Test
  fun `finds nothing on an empty table`() {
    assertNull(PageDetection.page(scene(null, noise = 20)))
  }

  @Test
  fun `ignores a page too small to scan`() {
    val page = PageQuad(PagePoint(0.45, 0.45), PagePoint(0.55, 0.45), PagePoint(0.55, 0.55), PagePoint(0.45, 0.55))

    assertNull(PageDetection.page(scene(page, text = false)))
  }

  @Test
  fun `ignores a long thin strip`() {
    val strip = PageQuad(PagePoint(0.1, 0.45), PagePoint(0.9, 0.45), PagePoint(0.9, 0.55), PagePoint(0.1, 0.55))

    assertNull(PageDetection.page(scene(strip, text = false)))
  }
}
