package cz.veevoy.ansora.core.mobile

import kotlin.math.abs
import kotlin.math.acos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sqrt

internal class Luminance(val width: Int, val height: Int, val values: IntArray) {
  init {
    require(width > 0 && height > 0 && values.size == width * height)
  }

  operator fun get(x: Int, y: Int): Int = values[y * width + x]
}

// NAB-191, CAP-018-R02, CAP-018-R04, CAP-018-R13
internal object PageDetection {
  private const val ANALYSIS_LONGER_SIDE = 320
  private const val MINIMUM_SIDE = 0.2
  private const val MINIMUM_ASPECT_RATIO = 0.3
  private const val QUADRATURE_TOLERANCE_DEGREES = 30.0
  private const val MINIMUM_SIDE_SUPPORT = 0.6
  private const val SUPPORT_SAMPLES = 40
  private const val SUPPORT_RADIUS = 2
  private const val HIGH_THRESHOLD_FRACTION = 0.2
  private const val LOW_THRESHOLD_FRACTION = 0.5
  private const val MINIMUM_HIGH_THRESHOLD = 24
  private const val NOISE_FLOOR_FACTOR = 4
  private const val MINIMUM_SIDE_CONTRAST = 12.0
  private const val CONTRAST_OFFSET = 3.0
  private const val MINIMUM_COMPONENT_PIXELS = 40
  private const val SIDE_BAND = 0.03
  private const val MINIMUM_SIDE_POINTS = 8
  private const val PARALLEL_EPSILON = 1e-9
  private const val CORNER_COUNT = 4
  private const val RIGHT_ANGLE_DEGREES = 90.0
  private const val STRAIGHT_ANGLE_DEGREES = 180.0

  fun page(image: Luminance): PageQuad? {
    val small = blurred(downscaled(image, ANALYSIS_LONGER_SIDE))
    val edges = edgeMap(small)
    val size = PageSize(small.width.toDouble(), small.height.toDouble())
    return edgeComponents(edges, small.width, small.height)
      .mapNotNull { component -> quadrilateral(component, size) }
      .filter { candidate ->
        isPlausible(candidate, size) &&
          sideSupport(candidate, edges, small.width, small.height) &&
          hasPageContrast(candidate, small)
      }
      .maxByOrNull { it.area }
      ?.mapped { PagePoint(it.x / size.width, it.y / size.height) }
      ?.takeIf { it.isDetectedPage }
  }

  private fun downscaled(image: Luminance, longerSide: Int): Luminance {
    val factor = max(1, (max(image.width, image.height) + longerSide - 1) / longerSide)
    if (factor == 1) {
      return image
    }
    val width = image.width / factor
    val height = image.height / factor
    val values = IntArray(width * height)
    val count = factor * factor
    for (y in 0 until height) {
      for (x in 0 until width) {
        var sum = 0
        for (dy in 0 until factor) {
          val row = (y * factor + dy) * image.width + x * factor
          for (dx in 0 until factor) {
            sum += image.values[row + dx]
          }
        }
        values[y * width + x] = sum / count
      }
    }
    return Luminance(width, height, values)
  }

  private fun blurred(image: Luminance): Luminance {
    val kernel = intArrayOf(1, 4, 6, 4, 1)
    val radius = kernel.size / 2
    val horizontal = IntArray(image.values.size)
    for (y in 0 until image.height) {
      for (x in 0 until image.width) {
        var sum = 0
        for (k in kernel.indices) {
          sum += kernel[k] * image[(x + k - radius).coerceIn(0, image.width - 1), y]
        }
        horizontal[y * image.width + x] = sum
      }
    }
    val values = IntArray(image.values.size)
    for (y in 0 until image.height) {
      for (x in 0 until image.width) {
        var sum = 0
        for (k in kernel.indices) {
          sum += kernel[k] * horizontal[(y + k - radius).coerceIn(0, image.height - 1) * image.width + x]
        }
        values[y * image.width + x] = sum / (16 * 16)
      }
    }
    return Luminance(image.width, image.height, values)
  }

  private fun edgeMap(image: Luminance): BooleanArray {
    val width = image.width
    val height = image.height
    val magnitude = IntArray(width * height)
    val direction = IntArray(width * height)
    var strongest = 0
    for (y in 1 until height - 1) {
      for (x in 1 until width - 1) {
        val gx =
          -image[x - 1, y - 1] - 2 * image[x - 1, y] - image[x - 1, y + 1] +
            image[x + 1, y - 1] + 2 * image[x + 1, y] + image[x + 1, y + 1]
        val gy =
          -image[x - 1, y - 1] - 2 * image[x, y - 1] - image[x + 1, y - 1] +
            image[x - 1, y + 1] + 2 * image[x, y + 1] + image[x + 1, y + 1]
        val value = abs(gx) + abs(gy)
        magnitude[y * width + x] = value
        direction[y * width + x] = sector(gx, gy)
        strongest = max(strongest, value)
      }
    }
    val noiseFloor = medianOf(magnitude, width, height) * NOISE_FLOOR_FACTOR
    val high = maxOf(MINIMUM_HIGH_THRESHOLD, (strongest * HIGH_THRESHOLD_FRACTION).roundToInt(), noiseFloor)
    val low = (high * LOW_THRESHOLD_FRACTION).roundToInt()
    val thin = suppressed(magnitude, direction, width, height)
    return hysteresis(thin, width, height, low, high)
  }

  private fun medianOf(magnitude: IntArray, width: Int, height: Int): Int {
    val counts = IntArray((magnitude.maxOrNull() ?: 0) + 1)
    var total = 0
    for (y in 1 until height - 1) {
      for (x in 1 until width - 1) {
        counts[magnitude[y * width + x]] += 1
        total += 1
      }
    }
    var seen = 0
    for (value in counts.indices) {
      seen += counts[value]
      if (seen * 2 >= total) {
        return value
      }
    }
    return 0
  }

  private fun sector(gx: Int, gy: Int): Int {
    val ax = abs(gx)
    val ay = abs(gy)
    return when {
      ay * 5 < ax * 2 -> 0
      ax * 5 < ay * 2 -> 2
      (gx > 0) == (gy > 0) -> 1
      else -> 3
    }
  }

  private fun suppressed(magnitude: IntArray, direction: IntArray, width: Int, height: Int): IntArray {
    val thin = IntArray(magnitude.size)
    for (y in 1 until height - 1) {
      for (x in 1 until width - 1) {
        val index = y * width + x
        val value = magnitude[index]
        if (value == 0) {
          continue
        }
        val (first, second) =
          when (direction[index]) {
            0 -> index - 1 to index + 1
            2 -> index - width to index + width
            1 -> index - width - 1 to index + width + 1
            else -> index - width + 1 to index + width - 1
          }
        if (value >= magnitude[first] && value >= magnitude[second]) {
          thin[index] = value
        }
      }
    }
    return thin
  }

  private fun hysteresis(thin: IntArray, width: Int, height: Int, low: Int, high: Int): BooleanArray {
    val edges = BooleanArray(thin.size)
    val stack = ArrayDeque<Int>()
    for (index in thin.indices) {
      if (thin[index] >= high && !edges[index]) {
        edges[index] = true
        stack.addLast(index)
        while (stack.isNotEmpty()) {
          val current = stack.removeLast()
          val cx = current % width
          val cy = current / width
          for (dy in -1..1) {
            for (dx in -1..1) {
              val nx = cx + dx
              val ny = cy + dy
              if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
                continue
              }
              val neighbour = ny * width + nx
              if (!edges[neighbour] && thin[neighbour] >= low) {
                edges[neighbour] = true
                stack.addLast(neighbour)
              }
            }
          }
        }
      }
    }
    return edges
  }

  private fun edgeComponents(edges: BooleanArray, width: Int, height: Int): List<List<PagePoint>> {
    val closed = dilated(edges, width, height)
    val visited = BooleanArray(closed.size)
    val components = mutableListOf<List<PagePoint>>()
    val stack = ArrayDeque<Int>()
    for (start in closed.indices) {
      if (!closed[start] || visited[start]) {
        continue
      }
      val points = mutableListOf<PagePoint>()
      visited[start] = true
      stack.addLast(start)
      while (stack.isNotEmpty()) {
        val current = stack.removeLast()
        val cx = current % width
        val cy = current / width
        if (edges[current]) {
          points.add(PagePoint(cx.toDouble(), cy.toDouble()))
        }
        for (dy in -1..1) {
          for (dx in -1..1) {
            val nx = cx + dx
            val ny = cy + dy
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
              continue
            }
            val neighbour = ny * width + nx
            if (closed[neighbour] && !visited[neighbour]) {
              visited[neighbour] = true
              stack.addLast(neighbour)
            }
          }
        }
      }
      if (points.size >= MINIMUM_COMPONENT_PIXELS) {
        components.add(points)
      }
    }
    return components
  }

  private fun dilated(edges: BooleanArray, width: Int, height: Int): BooleanArray {
    val result = BooleanArray(edges.size)
    for (y in 0 until height) {
      for (x in 0 until width) {
        if (!edges[y * width + x]) {
          continue
        }
        for (dy in -1..1) {
          for (dx in -1..1) {
            val nx = x + dx
            val ny = y + dy
            if (nx in 0 until width && ny in 0 until height) {
              result[ny * width + nx] = true
            }
          }
        }
      }
    }
    return result
  }

  private fun quadrilateral(points: List<PagePoint>, size: PageSize): PageQuad? {
    val hull = convexHull(points)
    if (hull.size < CORNER_COUNT) {
      return null
    }
    val coarse = largestQuad(hull) ?: return null
    return refined(coarse, points, size) ?: coarse
  }

  private fun largestQuad(hull: List<PagePoint>): PageQuad? {
    val count = hull.size
    var best: List<PagePoint>? = null
    var bestArea = 0.0
    for (first in 0 until count) {
      for (third in first + 2 until count) {
        var upper: PagePoint? = null
        var upperArea = 0.0
        for (second in first + 1 until third) {
          val area = abs(cross(hull[first], hull[second], hull[third]))
          if (area > upperArea) {
            upperArea = area
            upper = hull[second]
          }
        }
        var lower: PagePoint? = null
        var lowerArea = 0.0
        for (offset in third + 1 until first + count) {
          val fourth = hull[offset % count]
          val area = abs(cross(hull[third], fourth, hull[first]))
          if (area > lowerArea) {
            lowerArea = area
            lower = fourth
          }
        }
        if (upper != null && lower != null && upperArea + lowerArea > bestArea) {
          bestArea = upperArea + lowerArea
          best = listOf(hull[first], upper, hull[third], lower)
        }
      }
    }
    return best?.let { PageQuad.ordered(it) }
  }

  private fun refined(coarse: PageQuad, points: List<PagePoint>, size: PageSize): PageQuad? {
    val band = SIDE_BAND * PageGeometry.shorterSide(size)
    val corners = coarse.corners
    val lines = corners.indices.map { index ->
      val start = corners[index]
      val end = corners[(index + 1) % CORNER_COUNT]
      val near = points.filter { distanceToSegment(it, start, end) <= band }
      if (near.size >= MINIMUM_SIDE_POINTS) fittedLine(near) else Line.through(start, end)
    }
    val intersections = corners.indices.map { index -> lines[(index + CORNER_COUNT - 1) % CORNER_COUNT].intersection(lines[index]) }
    if (intersections.any { it == null }) {
      return null
    }
    val quad = PageQuad.ordered(intersections.filterNotNull()) ?: return null
    return quad.takeIf { it.maximumDistance(coarse) <= band * CORNER_COUNT }
  }

  private fun fittedLine(points: List<PagePoint>): Line {
    val meanX = points.sumOf { it.x } / points.size
    val meanY = points.sumOf { it.y } / points.size
    var xx = 0.0
    var xy = 0.0
    var yy = 0.0
    for (point in points) {
      val dx = point.x - meanX
      val dy = point.y - meanY
      xx += dx * dx
      xy += dx * dy
      yy += dy * dy
    }
    val angle = 0.5 * Math.atan2(2 * xy, xx - yy)
    return Line(PagePoint(meanX, meanY), PagePoint(Math.cos(angle), Math.sin(angle)))
  }

  private class Line(val origin: PagePoint, val direction: PagePoint) {
    fun intersection(other: Line): PagePoint? {
      val denominator = direction.x * other.direction.y - direction.y * other.direction.x
      if (abs(denominator) < PARALLEL_EPSILON) {
        return null
      }
      val dx = other.origin.x - origin.x
      val dy = other.origin.y - origin.y
      val t = (dx * other.direction.y - dy * other.direction.x) / denominator
      return PagePoint(origin.x + direction.x * t, origin.y + direction.y * t)
    }

    companion object {
      fun through(start: PagePoint, end: PagePoint): Line = Line(start, PagePoint(end.x - start.x, end.y - start.y))
    }
  }

  private fun convexHull(points: List<PagePoint>): List<PagePoint> {
    val sorted = points.distinct().sortedWith(compareBy<PagePoint> { it.x }.thenBy { it.y })
    if (sorted.size < 3) {
      return sorted
    }
    val lower = mutableListOf<PagePoint>()
    for (point in sorted) {
      while (lower.size >= 2 && cross(lower[lower.size - 2], lower[lower.size - 1], point) <= 0) {
        lower.removeAt(lower.size - 1)
      }
      lower.add(point)
    }
    val upper = mutableListOf<PagePoint>()
    for (point in sorted.asReversed()) {
      while (upper.size >= 2 && cross(upper[upper.size - 2], upper[upper.size - 1], point) <= 0) {
        upper.removeAt(upper.size - 1)
      }
      upper.add(point)
    }
    return lower.dropLast(1) + upper.dropLast(1)
  }

  private fun cross(origin: PagePoint, first: PagePoint, second: PagePoint): Double =
    (first.x - origin.x) * (second.y - origin.y) - (first.y - origin.y) * (second.x - origin.x)

  private fun distanceToSegment(point: PagePoint, start: PagePoint, end: PagePoint): Double {
    val dx = end.x - start.x
    val dy = end.y - start.y
    val lengthSquared = dx * dx + dy * dy
    if (lengthSquared == 0.0) {
      return point.distance(start)
    }
    val t = (((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared).coerceIn(0.0, 1.0)
    return hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy))
  }

  private fun isPlausible(quad: PageQuad, size: PageSize): Boolean {
    if (!quad.isConvex) {
      return false
    }
    val corners = quad.corners
    val sides = corners.indices.map { corners[it].distance(corners[(it + 1) % CORNER_COUNT]) }
    if (sides.min() < MINIMUM_SIDE * PageGeometry.shorterSide(size)) {
      return false
    }
    val widthSide = (sides[0] + sides[2]) / 2
    val heightSide = (sides[1] + sides[3]) / 2
    if (min(widthSide, heightSide) / max(widthSide, heightSide) < MINIMUM_ASPECT_RATIO) {
      return false
    }
    return corners.indices.all { index ->
      val angle = interiorAngle(
        corners[(index + CORNER_COUNT - 1) % CORNER_COUNT],
        corners[index],
        corners[(index + 1) % CORNER_COUNT],
      )
      abs(angle - RIGHT_ANGLE_DEGREES) <= QUADRATURE_TOLERANCE_DEGREES
    }
  }

  private fun interiorAngle(previous: PagePoint, corner: PagePoint, next: PagePoint): Double {
    val ax = previous.x - corner.x
    val ay = previous.y - corner.y
    val bx = next.x - corner.x
    val by = next.y - corner.y
    val lengths = sqrt(ax * ax + ay * ay) * sqrt(bx * bx + by * by)
    if (lengths == 0.0) {
      return 0.0
    }
    val cosine = ((ax * bx + ay * by) / lengths).coerceIn(-1.0, 1.0)
    return Math.toDegrees(acos(cosine)).coerceIn(0.0, STRAIGHT_ANGLE_DEGREES)
  }

  private fun sideSupport(quad: PageQuad, edges: BooleanArray, width: Int, height: Int): Boolean {
    val corners = quad.corners
    return corners.indices.all { index ->
      val start = corners[index]
      val end = corners[(index + 1) % CORNER_COUNT]
      val supported = (0 until SUPPORT_SAMPLES).count { sample ->
        val t = (sample + 0.5) / SUPPORT_SAMPLES
        isNearEdge(start.x + (end.x - start.x) * t, start.y + (end.y - start.y) * t, edges, width, height)
      }
      supported >= SUPPORT_SAMPLES * MINIMUM_SIDE_SUPPORT
    }
  }

  private fun hasPageContrast(quad: PageQuad, image: Luminance): Boolean {
    val corners = quad.corners
    val steps = corners.indices.map { index -> sideContrast(corners[index], corners[(index + 1) % CORNER_COUNT], image) }
    val brighter = steps.all { it >= MINIMUM_SIDE_CONTRAST }
    val darker = steps.all { it <= -MINIMUM_SIDE_CONTRAST }
    return brighter || darker
  }

  private fun sideContrast(start: PagePoint, end: PagePoint, image: Luminance): Double {
    val length = start.distance(end)
    if (length == 0.0) {
      return 0.0
    }
    val normalX = (end.y - start.y) / length
    val normalY = -(end.x - start.x) / length
    var sum = 0.0
    var count = 0
    for (sample in 0 until SUPPORT_SAMPLES) {
      val t = (sample + 0.5) / SUPPORT_SAMPLES
      val x = start.x + (end.x - start.x) * t
      val y = start.y + (end.y - start.y) * t
      val inside = sampled(image, x - normalX * CONTRAST_OFFSET, y - normalY * CONTRAST_OFFSET) ?: continue
      val outside = sampled(image, x + normalX * CONTRAST_OFFSET, y + normalY * CONTRAST_OFFSET) ?: continue
      sum += inside - outside
      count += 1
    }
    return if (count == 0) 0.0 else sum / count
  }

  private fun sampled(image: Luminance, x: Double, y: Double): Int? {
    val px = x.roundToInt()
    val py = y.roundToInt()
    if (px !in 0 until image.width || py !in 0 until image.height) {
      return null
    }
    return image[px, py]
  }

  private fun isNearEdge(x: Double, y: Double, edges: BooleanArray, width: Int, height: Int): Boolean {
    val cx = x.roundToInt()
    val cy = y.roundToInt()
    for (dy in -SUPPORT_RADIUS..SUPPORT_RADIUS) {
      for (dx in -SUPPORT_RADIUS..SUPPORT_RADIUS) {
        val nx = cx + dx
        val ny = cy + dy
        if (nx in 0 until width && ny in 0 until height && edges[ny * width + nx]) {
          return true
        }
      }
    }
    return false
  }
}
