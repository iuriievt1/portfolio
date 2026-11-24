package cz.veevoy.ansora.core.mobile

import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min

// CAP-018-R10
private const val MINIMUM_MANUAL_AREA = 0.01
// CAP-018-R02
private const val MINIMUM_DETECTED_AREA = 0.1
private const val CONVEXITY_EPSILON = 1e-9
private const val CORNER_COUNT = 4
private const val TURNS_PER_CIRCLE = 4
private const val DEGREES_PER_TURN = 90

internal data class PagePoint(val x: Double, val y: Double) {
  val isFinite: Boolean get() = x.isFinite() && y.isFinite()

  fun distance(to: PagePoint): Double = hypot(x - to.x, y - to.y)
}

internal data class PageSize(val width: Double, val height: Double) {
  val isEmpty: Boolean get() = width <= 0.0 || height <= 0.0
}

internal data class PageQuad(
  val topLeft: PagePoint,
  val topRight: PagePoint,
  val bottomRight: PagePoint,
  val bottomLeft: PagePoint,
) {
  val corners: List<PagePoint> get() = listOf(topLeft, topRight, bottomRight, bottomLeft)

  val area: Double
    get() {
      val points = corners
      var doubled = 0.0
      for (index in 0 until CORNER_COUNT) {
        val current = points[index]
        val next = points[(index + 1) % CORNER_COUNT]
        doubled += current.x * next.y - next.x * current.y
      }
      return abs(doubled) / 2
    }

  val isConvex: Boolean
    get() {
      val points = corners
      return (0 until CORNER_COUNT).all { index ->
        val first = points[index]
        val second = points[(index + 1) % CORNER_COUNT]
        val third = points[(index + 2) % CORNER_COUNT]
        val turn = (second.x - first.x) * (third.y - second.y) - (second.y - first.y) * (third.x - second.x)
        turn > CONVEXITY_EPSILON
      }
    }

  val isDetectedPage: Boolean get() = isConvex && area >= MINIMUM_DETECTED_AREA

  fun maximumDistance(other: PageQuad): Double = corners.zip(other.corners).maxOf { (mine, theirs) -> mine.distance(theirs) }

  fun interpolated(target: PageQuad, fraction: Double): PageQuad =
    PageQuad.of(
      corners.zip(target.corners).map { (current, goal) ->
        PagePoint(current.x + (goal.x - current.x) * fraction, current.y + (goal.y - current.y) * fraction)
      },
    )

  fun mapped(transform: (PagePoint) -> PagePoint): PageQuad =
    PageQuad(transform(topLeft), transform(topRight), transform(bottomRight), transform(bottomLeft))

  fun scaled(size: PageSize): PageQuad = mapped { PagePoint(it.x * size.width, it.y * size.height) }

  fun layerPoints(frame: PageSize, layer: PageSize): PageQuad {
    if (frame.isEmpty) {
      return this
    }
    val scale = max(layer.width / frame.width, layer.height / frame.height)
    val drawnWidth = frame.width * scale
    val drawnHeight = frame.height * scale
    val offsetX = (layer.width - drawnWidth) / 2
    val offsetY = (layer.height - drawnHeight) / 2
    return mapped { PagePoint(offsetX + it.x * drawnWidth, offsetY + it.y * drawnHeight) }
  }

  fun converted(source: PageSize, target: PageSize): PageQuad {
    if (source.isEmpty || target.isEmpty) {
      return this
    }
    val sourceAspect = source.width / source.height
    val targetAspect = target.width / target.height
    val width = if (sourceAspect < targetAspect) sourceAspect / targetAspect else 1.0
    val height = if (sourceAspect > targetAspect) targetAspect / sourceAspect else 1.0
    val originX = (1 - width) / 2
    val originY = (1 - height) / 2
    return mapped { PagePoint(originX + it.x * width, originY + it.y * height) }
  }

  companion object {
    val WHOLE_FRAME = PageQuad(PagePoint(0.0, 0.0), PagePoint(1.0, 0.0), PagePoint(1.0, 1.0), PagePoint(0.0, 1.0))

    fun of(points: List<PagePoint>): PageQuad = PageQuad(points[0], points[1], points[2], points[3])

    fun ordered(points: List<PagePoint>): PageQuad? {
      if (points.size != CORNER_COUNT || !points.all { it.isFinite }) {
        return null
      }
      val centerX = points.sumOf { it.x } / CORNER_COUNT
      val centerY = points.sumOf { it.y } / CORNER_COUNT
      val clockwise = points.sortedBy { atan2(it.y - centerY, it.x - centerX) }
      val start = clockwise.indices.minWith(
        compareBy<Int> { clockwise[it].x + clockwise[it].y }.thenBy { clockwise[it].y },
      )
      return of(clockwise.drop(start) + clockwise.take(start))
    }

    // CAP-018-R10
    fun manual(points: List<PagePoint>): PageQuad? {
      if (!points.all { it.isFinite }) {
        return null
      }
      val clamped = points.map { PagePoint(it.x.coerceIn(0.0, 1.0), it.y.coerceIn(0.0, 1.0)) }
      val quad = ordered(clamped) ?: return null
      return quad.takeIf { it.isConvex && it.area >= MINIMUM_MANUAL_AREA }
    }
  }
}

// CAP-018-R02
internal data class PreviewEdges(val quad: PageQuad, val frame: PageSize)

internal object PageGeometry {
  fun normalizedTurns(turns: Int): Int = ((turns % TURNS_PER_CIRCLE) + TURNS_PER_CIRCLE) % TURNS_PER_CIRCLE

  fun turnsOf(rotationDegrees: Int): Int = normalizedTurns(rotationDegrees / DEGREES_PER_TURN)

  fun uprightSize(width: Int, height: Int, rotationDegrees: Int): PageSize =
    if (turnsOf(rotationDegrees) % 2 == 1) {
      PageSize(height.toDouble(), width.toDouble())
    } else {
      PageSize(width.toDouble(), height.toDouble())
    }

  fun upright(quad: PageQuad, rotationDegrees: Int): PageQuad? {
    val turns = turnsOf(rotationDegrees)
    return PageQuad.ordered(quad.corners.map { uprightPoint(it, turns) })
  }

  private fun uprightPoint(point: PagePoint, turns: Int): PagePoint =
    when (turns) {
      1 -> PagePoint(1 - point.y, point.x)
      2 -> PagePoint(1 - point.x, 1 - point.y)
      3 -> PagePoint(point.y, 1 - point.x)
      else -> point
    }

  fun longerSide(size: PageSize): Double = max(size.width, size.height)

  fun shorterSide(size: PageSize): Double = min(size.width, size.height)
}

// CAP-018-R02
internal class EdgeTracker {
  var quad: PageQuad? = null
    private set
  var isFound = false
    private set
  private var lastDetected: PageQuad? = null
  private var steadyCount = 0
  private var missCount = 0

  fun track(detected: PageQuad?) {
    if (detected == null) {
      miss()
      return
    }
    missCount = 0
    val isSteady = lastDetected?.let { it.maximumDistance(detected) <= STEADY_TOLERANCE } ?: false
    steadyCount = if (isSteady) steadyCount + 1 else 1
    lastDetected = detected
    quad = smoothed(detected)
    if (steadyCount >= STEADY_FRAMES) {
      isFound = true
    }
  }

  fun reset() {
    quad = null
    isFound = false
    lastDetected = null
    steadyCount = 0
    missCount = 0
  }

  private fun smoothed(detected: PageQuad): PageQuad {
    val current = quad ?: return detected
    if (current.maximumDistance(detected) >= SNAP_DISTANCE) {
      return detected
    }
    return current.interpolated(detected, SMOOTHING)
  }

  private fun miss() {
    missCount += 1
    if (missCount >= LOST_FRAMES) {
      reset()
    }
  }

  companion object {
    const val STEADY_FRAMES = 4
    const val LOST_FRAMES = 4
    const val STEADY_TOLERANCE = 0.02
    const val SNAP_DISTANCE = 0.1
    const val SMOOTHING = 0.5
  }
}
