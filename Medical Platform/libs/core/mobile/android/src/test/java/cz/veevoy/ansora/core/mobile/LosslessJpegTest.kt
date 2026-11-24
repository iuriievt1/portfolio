package cz.veevoy.ansora.core.mobile

import java.io.File
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Test

// libjpeg-turbo
class LosslessJpegTest {
  @Before
  fun referenceToolsInstalled() {
    assumeTrue(listOf("cjpeg", "djpeg", "jpegtran").all { isInstalled(it) })
  }

  @Test
  fun `CAP-015-S07 turns every orientation upright exactly as jpegtran does`() {
    val transforms = mapOf(
      2 to listOf("-flip", "horizontal"), 3 to listOf("-rotate", "180"), 4 to listOf("-flip", "vertical"),
      5 to listOf("-transpose"), 6 to listOf("-rotate", "90"), 7 to listOf("-transverse"), 8 to listOf("-rotate", "270"),
    )
    for (sampling in SAMPLINGS) {
      for ((width, height) in SIZES) {
        val source = camera(width, height, sampling, null)
        for ((orientation, arguments) in transforms) {
          val tagged = withMetadata(source, orientation)
          val ours = LosslessJpeg.upright(tagged)
          val reference = jpegtran(tagged, arguments + "-trim")
          assertArrayEquals("$sampling ${width}x$height orientation $orientation", decoded(reference), decoded(ours.bytes))
          assertEquals(ExifOrientation.TOP_LEFT, JpegMetadata.orientation(JpegFile.parse(ours.bytes)))
        }
      }
    }
  }

  @Test
  fun `CAP-015-R34 rotates by quarter turns exactly as jpegtran does`() {
    for (sampling in SAMPLINGS) {
      for ((width, height) in SIZES) {
        val upright = LosslessJpeg.upright(withMetadata(camera(width, height, sampling, null), 1)).bytes
        for (turns in 1..3) {
          val ours = LosslessJpeg.rotatedClockwise(upright, turns)
          val reference = jpegtran(upright, listOf("-rotate", (turns * 90).toString(), "-trim"))
          assertArrayEquals("$sampling ${width}x$height rotate ${turns * 90}", decoded(reference), decoded(ours.bytes))
        }
      }
    }
  }

  @Test
  fun `CAP-015-R03 crops on the block grid exactly as jpegtran does`() {
    for (sampling in SAMPLINGS) {
      val upright = LosslessJpeg.upright(withMetadata(camera(64, 48, sampling, null), 1)).bytes
      val ours = LosslessJpeg.cropped(upright, PixelRect(17.0, 15.0, 30.0, 18.0))
      val reference = jpegtran(upright, listOf("-crop", "${ours.width}x${ours.height}+16+16"))
      assertArrayEquals("$sampling crop", decoded(reference), decoded(ours.bytes))
    }
  }

  @Test
  fun `decodes restart intervals and grayscale`() {
    for ((sampling, restart) in listOf("2x2" to "3B", "2x2" to "1", null to null)) {
      val source = camera(640, 480, sampling, restart)
      val tagged = withMetadata(source, 6)
      assertArrayEquals(decoded(jpegtran(tagged, listOf("-rotate", "90", "-trim"))), decoded(LosslessJpeg.upright(tagged).bytes))
    }
  }

  @Test
  fun `CAP-015-R14 removes location, device and comments and keeps the colour profile`() {
    val cleaned = LosslessJpeg.upright(withMetadata(camera(64, 48, "2x2", null), 6)).bytes
    val file = JpegFile.parse(cleaned)
    assertFalse(contains(cleaned, "VulnaPhone".toByteArray()))
    assertFalse(contains(cleaned, "http://ns.adobe.com/xap/1.0/".toByteArray()))
    assertFalse(contains(cleaned, "bed 12".toByteArray()))
    assertTrue(file.segments.any { it.marker == JpegMarker.ICC_PROFILE && it.payload.contentEquals(ICC_SEGMENT) })
    assertEquals(JpegMarker.BASELINE_FRAME, file.frameMarker)
  }

  @Test
  fun `CAP-015-R14 keeps the scan of an upright photo byte for byte`() {
    val source = camera(640, 480, "2x2", null)
    val cleaned = LosslessJpeg.upright(withMetadata(source, 1)).bytes
    assertEquals(scans(source), scans(cleaned))
  }

  private fun camera(width: Int, height: Int, sampling: String?, restart: String?): ByteArray {
    val header = "P6\n$width $height\n255\n".toByteArray()
    val pixels = ByteArray(width * height * 3)
    var index = 0
    for (y in 0 until height) {
      for (x in 0 until width) {
        pixels[index++] = ((x * 255) / maxOf(width - 1, 1)).toByte()
        pixels[index++] = ((y * 255) / maxOf(height - 1, 1)).toByte()
        pixels[index++] = (((x / 7 + y / 5) % 2) * 200 + (x * y) % 55).toByte()
      }
    }
    val arguments = mutableListOf("-quality", "88")
    arguments += if (sampling == null) listOf("-grayscale") else listOf("-sample", sampling)
    if (restart != null) {
      arguments += listOf("-restart", restart)
    }
    return run("cjpeg", arguments, header + pixels)
  }

  private fun withMetadata(jpeg: ByteArray, orientation: Int): ByteArray {
    val tiff = byteArrayOf(
      0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00,
      0x02, 0x00,
      0x0F, 0x01, 0x02, 0x00, 0x0B, 0x00, 0x00, 0x00, 0x26, 0x00, 0x00, 0x00,
      0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, orientation.toByte(), 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
    ) + "VulnaPhone\u0000".toByteArray()
    val segments = listOf(
      0xE1 to "Exif\u0000\u0000".toByteArray() + tiff,
      0xE1 to "http://ns.adobe.com/xap/1.0/\u0000<x:xmpmeta/>".toByteArray(),
      0xE2 to ICC_SEGMENT,
      0xFE to "bed 12".toByteArray(),
    )
    var result = byteArrayOf(0xFF.toByte(), 0xD8.toByte())
    for ((marker, payload) in segments) {
      val length = payload.size + 2
      result += byteArrayOf(0xFF.toByte(), marker.toByte(), (length shr 8).toByte(), (length and 0xFF).toByte()) + payload
    }
    return result + jpeg.copyOfRange(2, jpeg.size) + "trailing gain map".toByteArray()
  }

  private fun scans(jpeg: ByteArray): List<List<Byte>> =
    JpegFile.parse(jpeg).parts.filterIsInstance<JpegPart.Scan>().map { it.scan.entropyData.toList() }

  private fun jpegtran(jpeg: ByteArray, arguments: List<String>): ByteArray = run("jpegtran", listOf("-copy", "none") + arguments, jpeg)

  private fun decoded(jpeg: ByteArray): ByteArray = run("djpeg", listOf("-ppm"), jpeg)

  private fun run(tool: String, arguments: List<String>, input: ByteArray): ByteArray {
    val inputFile = File.createTempFile("lossless-jpeg", ".bin").apply {
      writeBytes(input)
      deleteOnExit()
    }
    val process = ProcessBuilder(listOf(tool) + arguments + inputFile.absolutePath).start()
    val output = process.inputStream.readBytes()
    val warnings = process.errorStream.readBytes()
    assertEquals("$tool $arguments", 0, process.waitFor())
    assertEquals("$tool $arguments", "", String(warnings))
    return output
  }

  private fun isInstalled(tool: String): Boolean =
    runCatching { ProcessBuilder("which", tool).start().waitFor() == 0 }.getOrDefault(false)

  private fun contains(haystack: ByteArray, needle: ByteArray): Boolean =
    (0..haystack.size - needle.size).any { start -> needle.indices.all { haystack[start + it] == needle[it] } }

  private companion object {
    val SAMPLINGS = listOf("2x2", "2x1", "1x1")
    val SIZES = listOf(64 to 48, 640 to 480, 100 to 75)
    val ICC_SEGMENT = "ICC_PROFILE\u0000".toByteArray() + byteArrayOf(1, 1) + ByteArray(40) { 0x42 }
  }
}
