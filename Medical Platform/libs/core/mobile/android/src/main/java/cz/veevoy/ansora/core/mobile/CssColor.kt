package cz.veevoy.ansora.core.mobile

import kotlin.math.roundToInt

private const val CHANNEL_MAX = 255
private const val SHORT_HEX_LENGTH = 3
private const val HEX_LENGTH = 6
private const val HEX_WITH_ALPHA_LENGTH = 8
private const val HEX_RADIX = 16
private const val OPAQUE = 0xFF

// A.1 Skener
internal object CssColor {
  private val function = Regex("""^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([0-9]*\.?[0-9]+)\s*)?\)$""")

  fun parse(value: String): Int? {
    val text = value.trim()
    if (text.startsWith("#")) {
      return hex(text.drop(1))
    }
    val match = function.matchEntire(text) ?: return null
    val (red, green, blue) = match.destructured.toList().take(3).map { it.toInt() }
    if (listOf(red, green, blue).any { it > CHANNEL_MAX }) {
      return null
    }
    val alpha = match.groupValues[4].takeIf { it.isNotEmpty() }?.toDoubleOrNull()?.coerceIn(0.0, 1.0) ?: 1.0
    return argb((alpha * CHANNEL_MAX).roundToInt(), red, green, blue)
  }

  private fun hex(digits: String): Int? {
    if (!digits.all { it.isDigit() || it.lowercaseChar() in 'a'..'f' }) {
      return null
    }
    return when (digits.length) {
      SHORT_HEX_LENGTH -> {
        val (red, green, blue) = digits.map { "$it$it".toInt(HEX_RADIX) }
        argb(OPAQUE, red, green, blue)
      }
      HEX_LENGTH -> argb(OPAQUE, channel(digits, 0), channel(digits, 1), channel(digits, 2))
      HEX_WITH_ALPHA_LENGTH -> argb(channel(digits, 3), channel(digits, 0), channel(digits, 1), channel(digits, 2))
      else -> null
    }
  }

  private fun channel(digits: String, index: Int): Int = digits.substring(index * 2, index * 2 + 2).toInt(HEX_RADIX)

  private fun argb(alpha: Int, red: Int, green: Int, blue: Int): Int = (alpha shl 24) or (red shl 16) or (green shl 8) or blue
}
