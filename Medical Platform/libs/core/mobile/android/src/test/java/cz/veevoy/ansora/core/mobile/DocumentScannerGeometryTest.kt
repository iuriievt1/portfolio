package cz.veevoy.ansora.core.mobile

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

private const val DELTA = 1e-9

private fun point(x: Double, y: Double) = PagePoint(x, y)

class DocumentScannerGeometryTest {
  @Test
  fun `orders corners clockwise from the top left`() {
    val quad = PageQuad.ordered(listOf(point(0.9, 0.9), point(0.1, 0.1), point(0.1, 0.9), point(0.9, 0.1)))

    assertEquals(PageQuad(point(0.1, 0.1), point(0.9, 0.1), point(0.9, 0.9), point(0.1, 0.9)), quad)
  }

  @Test
  fun `refuses corners that are not four finite points`() {
    assertNull(PageQuad.ordered(listOf(point(0.0, 0.0), point(1.0, 0.0), point(1.0, 1.0))))
    assertNull(PageQuad.ordered(listOf(point(0.0, 0.0), point(1.0, 0.0), point(1.0, Double.NaN), point(0.0, 1.0))))
  }

  @Test
  fun `measures area and convexity`() {
    assertEquals(1.0, PageQuad.WHOLE_FRAME.area, DELTA)
    assertTrue(PageQuad.WHOLE_FRAME.isConvex)
    val bowTie = PageQuad(point(0.0, 0.0), point(1.0, 1.0), point(1.0, 0.0), point(0.0, 1.0))
    assertFalse(bowTie.isConvex)
  }

  @Test
  fun `clamps manual corners into the photo and refuses tiny ones`() {
    val clamped = PageQuad.manual(listOf(point(-0.2, -0.1), point(1.3, 0.0), point(1.0, 1.4), point(0.0, 1.0)))
    assertEquals(PageQuad.WHOLE_FRAME, clamped)
    val tiny = listOf(point(0.5, 0.5), point(0.55, 0.5), point(0.55, 0.55), point(0.5, 0.55))
    assertNull(PageQuad.manual(tiny))
  }

  @Test
  fun `maps a quad onto an aspect-filled preview`() {
    val layer = PageQuad.WHOLE_FRAME.layerPoints(PageSize(300.0, 400.0), PageSize(300.0, 300.0))

    assertEquals(point(0.0, -50.0), layer.topLeft)
    assertEquals(point(300.0, 350.0), layer.bottomRight)
  }

  @Test
  fun `converts a preview quad into a photo of another shape`() {
    val converted = PageQuad.WHOLE_FRAME.converted(PageSize(3.0, 4.0), PageSize(4.0, 4.0))

    assertEquals(0.125, converted.topLeft.x, DELTA)
    assertEquals(0.875, converted.topRight.x, DELTA)
    assertEquals(0.0, converted.topLeft.y, DELTA)
  }

  @Test
  fun `turns sensor coordinates upright`() {
    val sensor = PageQuad(point(0.1, 0.2), point(0.6, 0.2), point(0.6, 0.7), point(0.1, 0.7))

    val upright = PageGeometry.upright(sensor, 90)

    assertNotNull(upright)
    val expected = PageQuad(point(0.3, 0.1), point(0.8, 0.1), point(0.8, 0.6), point(0.3, 0.6))
    assertEquals(0.0, expected.maximumDistance(upright!!), DELTA)
    assertEquals(PageSize(480.0, 640.0), PageGeometry.uprightSize(640, 480, 90))
    assertEquals(PageSize(640.0, 480.0), PageGeometry.uprightSize(640, 480, 180))
  }

  @Test
  fun `reports a page only after it holds still`() {
    val tracker = EdgeTracker()
    val page = PageQuad(point(0.2, 0.2), point(0.8, 0.2), point(0.8, 0.8), point(0.2, 0.8))

    repeat(EdgeTracker.STEADY_FRAMES - 1) { tracker.track(page) }
    assertFalse(tracker.isFound)
    tracker.track(page)
    assertTrue(tracker.isFound)
  }

  @Test
  fun `forgets the page after it is lost for several frames`() {
    val tracker = EdgeTracker()
    val page = PageQuad(point(0.2, 0.2), point(0.8, 0.2), point(0.8, 0.8), point(0.2, 0.8))
    repeat(EdgeTracker.STEADY_FRAMES) { tracker.track(page) }

    repeat(EdgeTracker.LOST_FRAMES - 1) { tracker.track(null) }
    assertNotNull(tracker.quad)
    tracker.track(null)
    assertNull(tracker.quad)
    assertFalse(tracker.isFound)
  }

  @Test
  fun `smooths small movements and snaps to large ones`() {
    val tracker = EdgeTracker()
    val page = PageQuad(point(0.2, 0.2), point(0.8, 0.2), point(0.8, 0.8), point(0.2, 0.8))
    tracker.track(page)

    val nudged = page.mapped { point(it.x + 0.04, it.y) }
    tracker.track(nudged)
    assertEquals(0.22, tracker.quad!!.topLeft.x, DELTA)

    val moved = page.mapped { point(it.x + 0.15, it.y) }
    tracker.track(moved)
    assertEquals(moved, tracker.quad)
  }
}
