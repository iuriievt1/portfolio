package cz.veevoy.ansora.core.mobile

import android.app.Activity
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.view.KeyEvent
import android.view.Window
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.ByteArrayOutputStream
import kotlin.math.max
import kotlin.math.roundToInt

private const val SHUTTER_KEY_EVENT = "shutterKey"
// mobilni-aplikace.md 4.1
private const val THUMBNAIL_LONGER_SIDE = 1024
private const val THUMBNAIL_QUALITY = 70
// CAP-015-R05
private const val CONVERSION_QUALITY = 100

class SecuredPhoto : Record {
  @Field var image: EncryptedFile = EncryptedFile()
  @Field var thumbnail: EncryptedFile = EncryptedFile()
  @Field var width: Int = 0
  @Field var height: Int = 0
}

class PhotoCrop : Record {
  @Field var x: Double = 0.0
  @Field var y: Double = 0.0
  @Field var width: Double = 0.0
  @Field var height: Double = 0.0
}

// E18
class PhotoUnreadableException :
  CodedException("photo-unreadable", "The photo cannot be prepared for sending", null)

// TS-140, NAB-058, NAB-154, ADR-026, CAP-015-R14, CAP-015-R34, CAP-009-R09
class CameraModule : Module() {
  private val files by lazy {
    EncryptedFiles(Vault(appContext.reactContext ?: throw Exceptions.ReactContextLost()), MasterKeys())
  }
  private var shutterKeys: ShutterKeyCallback? = null

  override fun definition() = ModuleDefinition {
    Name("Camera")

    Events(SHUTTER_KEY_EVENT)

    AsyncFunction("securePhoto") { photo: ByteArray ->
      secure(PhotoPreparation.upright(photo))
    }

    AsyncFunction("rotatePhoto") { path: String, wrappedKey: String, quarterTurns: Int ->
      val photo = files.open(path, wrappedKey, KeyDomain.QUEUE)
      secure(PhotoPreparation.readable { LosslessJpeg.rotatedClockwise(photo, quarterTurns) })
    }

    AsyncFunction("cropPhoto") { path: String, wrappedKey: String, crop: PhotoCrop ->
      val rect = pixelRect(crop)
      val photo = files.open(path, wrappedKey, KeyDomain.QUEUE)
      secure(PhotoPreparation.readable { LosslessJpeg.cropped(photo, rect) })
    }

    OnStartObserving {
      appContext.currentActivity?.let { activity -> activity.runOnUiThread { startShutterKeys(activity) } }
    }

    OnStopObserving {
      appContext.currentActivity?.let { activity -> activity.runOnUiThread { stopShutterKeys(activity) } }
    }
  }

  // CAP-009-R02, CAP-009-R06, CAP-009-R17
  private fun secure(photo: PreparedJpeg): SecuredPhoto {
    val thumbnailBytes = PhotoPreparation.thumbnail(photo.bytes)
    val storedImage = files.store(photo.bytes, KeyDomain.QUEUE)
    try {
      val storedThumbnail = files.store(thumbnailBytes, KeyDomain.QUEUE)
      return SecuredPhoto().also { secured ->
        secured.image = storedImage
        secured.thumbnail = storedThumbnail
        secured.width = photo.width
        secured.height = photo.height
      }
    } catch (failure: Exception) {
      runCatching { files.vault.remove(storedImage.path) }
      throw failure
    }
  }

  // E18
  private fun pixelRect(crop: PhotoCrop): PixelRect {
    val hasNumbers = listOf(crop.x, crop.y, crop.width, crop.height).all { it.isFinite() }
    if (!hasNumbers || crop.width <= 0.0 || crop.height <= 0.0) {
      throw PhotoUnreadableException()
    }
    return PixelRect(crop.x, crop.y, crop.width, crop.height)
  }

  // CAP-015-R10
  private fun startShutterKeys(activity: Activity) {
    if (shutterKeys != null) {
      return
    }
    val window = activity.window
    val callback = ShutterKeyCallback(window.callback) { sendEvent(SHUTTER_KEY_EVENT) }
    window.callback = callback
    shutterKeys = callback
  }

  private fun stopShutterKeys(activity: Activity) {
    val callback = shutterKeys ?: return
    if (activity.window.callback === callback) {
      activity.window.callback = callback.wrapped
    }
    shutterKeys = null
  }
}

private class ShutterKeyCallback(val wrapped: Window.Callback, private val onPress: () -> Unit) :
  Window.Callback by wrapped {
  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    if (event.keyCode != KeyEvent.KEYCODE_VOLUME_UP && event.keyCode != KeyEvent.KEYCODE_VOLUME_DOWN) {
      return wrapped.dispatchKeyEvent(event)
    }
    if (event.action == KeyEvent.ACTION_UP) {
      onPress()
    }
    return true
  }
}

internal object PhotoPreparation {
  // CAP-015-R14, CAP-015-R05, CAP-015-S06, E18
  fun upright(photo: ByteArray): PreparedJpeg =
    try {
      LosslessJpeg.upright(photo)
    } catch (unsupported: JpegUnsupportedException) {
      readable { LosslessJpeg.upright(baseline(photo)) }
    } catch (unreadable: Exception) {
      throw PhotoUnreadableException()
    }

  // mobilni-aplikace.md 4.1
  fun thumbnail(photo: ByteArray): ByteArray {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeByteArray(photo, 0, photo.size, bounds)
    val longer = max(bounds.outWidth, bounds.outHeight)
    if (longer <= 0) {
      throw PhotoUnreadableException()
    }
    var sample = 1
    while (longer / (sample * 2) >= THUMBNAIL_LONGER_SIDE) {
      sample *= 2
    }
    val decoded = BitmapFactory.decodeByteArray(photo, 0, photo.size, BitmapFactory.Options().apply { inSampleSize = sample })
      ?: throw PhotoUnreadableException()
    val scale = minOf(1.0, THUMBNAIL_LONGER_SIDE.toDouble() / max(decoded.width, decoded.height))
    val scaled = if (scale < 1.0) {
      Bitmap.createScaledBitmap(decoded, (decoded.width * scale).roundToInt(), (decoded.height * scale).roundToInt(), true)
    } else {
      decoded
    }
    val encoded = compressed(scaled, THUMBNAIL_QUALITY)
    if (scaled !== decoded) {
      scaled.recycle()
    }
    decoded.recycle()
    return readable { LosslessJpeg.withoutMetadata(encoded) }
  }

  // CAP-015-R05
  private fun baseline(photo: ByteArray): ByteArray {
    val orientation = JpegMetadata.orientation(JpegFile.parse(photo))
    val decoded = BitmapFactory.decodeByteArray(photo, 0, photo.size) ?: throw PhotoUnreadableException()
    val upright = Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, orientationMatrix(orientation), true)
    val encoded = compressed(upright, CONVERSION_QUALITY)
    if (upright !== decoded) {
      upright.recycle()
    }
    decoded.recycle()
    return encoded
  }

  // Exif 2.3 Orientation
  private fun orientationMatrix(orientation: ExifOrientation): Matrix = Matrix().apply {
    when (orientation) {
      ExifOrientation.TOP_LEFT -> {}
      ExifOrientation.TOP_RIGHT -> setScale(-1f, 1f)
      ExifOrientation.BOTTOM_RIGHT -> setRotate(180f)
      ExifOrientation.BOTTOM_LEFT -> {
        setRotate(180f)
        postScale(-1f, 1f)
      }
      ExifOrientation.LEFT_TOP -> {
        setRotate(90f)
        postScale(-1f, 1f)
      }
      ExifOrientation.RIGHT_TOP -> setRotate(90f)
      ExifOrientation.RIGHT_BOTTOM -> {
        setRotate(-90f)
        postScale(-1f, 1f)
      }
      ExifOrientation.LEFT_BOTTOM -> setRotate(-90f)
    }
  }

  private fun compressed(bitmap: Bitmap, quality: Int): ByteArray {
    val output = ByteArrayOutputStream()
    if (!bitmap.compress(Bitmap.CompressFormat.JPEG, quality, output)) {
      throw PhotoUnreadableException()
    }
    return output.toByteArray()
  }

  // E18
  fun <T> readable(preparation: () -> T): T =
    try {
      preparation()
    } catch (unreadable: Exception) {
      throw PhotoUnreadableException()
    }
}
