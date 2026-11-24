package cz.veevoy.ansora.core.mobile

import android.graphics.Bitmap
import android.util.Log
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import java.util.UUID
import java.util.concurrent.Callable
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutionException
import java.util.concurrent.Executors
import java.util.concurrent.Future

private const val LOG_TAG = "DocumentScanner"

internal class CapturedPhoto(val jpeg: ByteArray, val rotationDegrees: Int)

// CAP-018-R03, CAP-018-R04, CAP-018-R08, CAP-018-R10, CAP-018-R11, CAP-009-R17
internal class DocumentScannerPages(private val files: EncryptedFiles) {
  private val queue = Executors.newSingleThreadExecutor()
  private val results = ConcurrentHashMap<String, Future<ScannedPage>>()

  // CAP-018-R02, CAP-018-R03
  fun capture(photo: CapturedPhoto, preview: PreviewEdges?, promise: Promise) {
    val id = UUID.randomUUID().toString()
    val scanned = CompletableFuture<ScannedPage>()
    results[id] = scanned
    queue.execute {
      val original = try {
        unreadableUnless { uprightOriginal(photo) }
      } catch (failure: Exception) {
        promise.resolve(capturedPage(id, null))
        scanned.completeExceptionally(failure)
        return@execute
      }
      promise.resolve(capturedPage(id, previewOf(original, preview)))
      try {
        scanned.complete(scan(original, preview))
      } catch (failure: Exception) {
        scanned.completeExceptionally(failure)
      }
    }
  }

  // CAP-018-R08
  fun scanned(id: String): ScannedPage {
    val result = results.remove(id) ?: throw ScannerNotReadyException()
    return outcomeOf(result)
  }

  // CAP-018-R10, CAP-018-R11
  fun recrop(original: EncryptedFile, corners: PageCorners, quarterTurns: Int): CroppedPage =
    outcomeOf(
      queue.submit(
        Callable {
          val edges = corners.quad()
          val bytes = files.open(original.path, original.wrappedKey, KeyDomain.QUEUE)
          val image = unreadableUnless { PageImaging.decoded(bytes) }
          val batch = FileBatch(files)
          try {
            croppedPage(image, edges, quarterTurns, batch)
          } catch (failure: Exception) {
            batch.discard()
            throw failure
          }
        },
      ),
    )

  // CAP-015-R14
  private fun uprightOriginal(photo: CapturedPhoto): PreparedJpeg {
    val isTagged = JpegMetadata.orientation(JpegFile.parse(photo.jpeg)) != ExifOrientation.TOP_LEFT
    val upright = PhotoPreparation.upright(photo.jpeg)
    val turns = PageGeometry.turnsOf(photo.rotationDegrees)
    if (isTagged || turns == 0) {
      return upright
    }
    return LosslessJpeg.rotatedClockwise(upright.bytes, turns)
  }

  // CAP-018-R02
  private fun previewOf(original: PreparedJpeg, preview: PreviewEdges?): String? =
    try {
      PageImaging.preview(original.bytes, preview)
    } catch (failure: Throwable) {
      Log.w(LOG_TAG, "The page preview could not be prepared", failure)
      null
    }

  // CAP-015-R14, CAP-018-R02, CAP-018-R03
  private fun scan(original: PreparedJpeg, preview: PreviewEdges?): ScannedPage {
    val image = unreadableUnless { PageImaging.decoded(original.bytes) }
    val edges = try {
      unreadableUnless { PageImaging.pageEdges(image, preview) }
    } catch (failure: Exception) {
      image.recycle()
      throw failure
    }
    val batch = FileBatch(files)
    try {
      val cropped = croppedPage(image, edges, 0, batch)
      return ScannedPage.of(cropped, batch.add(original.bytes))
    } catch (failure: Exception) {
      batch.discard()
      throw failure
    }
  }

  // CAP-009-R02, CAP-009-R06
  private fun croppedPage(
    image: Bitmap,
    edges: PageQuad?,
    quarterTurns: Int,
    batch: FileBatch,
  ): CroppedPage {
    val page = unreadableUnless { PageImaging.page(image, edges, quarterTurns) }
    val thumbnail = PhotoPreparation.thumbnail(page.bytes)
    return CroppedPage().also {
      it.page = batch.add(page.bytes)
      it.thumbnail = batch.add(thumbnail)
      it.corners = edges?.let { quad -> PageCorners.of(quad) }
      it.width = page.width
      it.height = page.height
    }
  }

  private fun capturedPage(id: String, preview: String?): CapturedPage = CapturedPage().also {
    it.id = id
    it.preview = preview
  }

  private fun <T> outcomeOf(future: Future<T>): T =
    try {
      future.get()
    } catch (failure: ExecutionException) {
      throw failure.cause as? CodedException ?: PhotoUnreadableException()
    }

  // E18
  private fun <T> unreadableUnless(preparation: () -> T): T =
    try {
      preparation()
    } catch (coded: CodedException) {
      throw coded
    } catch (failure: Exception) {
      Log.w(LOG_TAG, "The page could not be prepared", failure)
      throw PhotoUnreadableException()
    } catch (exhausted: OutOfMemoryError) {
      Log.w(LOG_TAG, "The page did not fit into memory", exhausted)
      throw PhotoUnreadableException()
    }
}

// CAP-009-R17
private class FileBatch(private val files: EncryptedFiles) {
  private val stored = mutableListOf<EncryptedFile>()

  fun add(bytes: ByteArray): EncryptedFile = files.store(bytes, KeyDomain.QUEUE).also { stored.add(it) }

  fun discard() {
    stored.forEach { file -> runCatching { files.vault.remove(file.path) } }
    stored.clear()
  }
}
