package cz.veevoy.ansora.core.mobile

import android.content.Context
import java.io.File
import java.io.IOException
import java.util.UUID
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull

private const val BOUNDARY_PREFIX = "ansora-vulna-"
private const val STEM_SEPARATOR = "."
private val UPLOAD_ID = Regex("^[A-Za-z0-9_-]{1,128}$")
private val UPLOAD_SCHEMES = setOf("https", "http")
private const val LONGEST_DELAY_MS = 3_600_000.0

internal class BackgroundTransfer(context: Context) {
  private val context = context.applicationContext
  private val files = UploadFiles(this.context)

  // CAP-009-R13, ADR-015
  fun start(request: UploadRequest) {
    if (!UPLOAD_ID.matches(request.id)) {
      throw UploadIdInvalidException(request.id)
    }
    val announcement = request.announcement
    val urls = listOfNotNull(request.url, announcement?.url, announcement?.verificationUrl)
    urls.firstOrNull { !isUploadUrl(it) }?.let { throw UploadUrlInvalidException(it) }
    if (request.delayMs.isNaN() || request.delayMs < 0 || request.delayMs > LONGEST_DELAY_MS) {
      throw UploadDelayInvalidException(request.delayMs)
    }
    request.files.firstOrNull { !File(it.path).canRead() }?.let { throw UploadFileMissingException(it.path) }
    val stem = request.id + STEM_SEPARATOR + UUID.randomUUID()
    val boundary = BOUNDARY_PREFIX + UUID.randomUUID()
    synchronized(UploadJobs.lock) {
      try {
        val body = files.writeBody(stem, boundary, request.fields, request.files)
        files.writeRequest(
          stem,
          StoredRequest(
            request.id,
            request.url,
            multipartTypeOf(boundary),
            request.headers,
            announcement?.let(::storedAnnouncementOf),
            null,
          ),
        )
        UploadJobs.schedule(context, stem, body.length(), request.delayMs.toLong())
      } catch (failure: IOException) {
        files.remove(stem)
        throw UploadNotStoredException(request.id)
      } catch (failure: UploadNotScheduledException) {
        files.remove(stem)
        throw failure
      }
    }
  }

  // ADR-014, CAP-025-R17
  fun grant(id: String, permission: String) = synchronized(UploadJobs.lock) {
    for (stem in files.stems().filter { uploadIdOf(it) == id && it !in UploadJobs.running }) {
      val stored = files.readRequest(stem)
      if (stored?.announcement == null) {
        continue
      }
      try {
        files.writeRequest(stem, stored.copy(permission = permission))
        UploadJobs.scheduleAgain(context, stem, files.body(stem).length())
      } catch (failure: IOException) {
        throw UploadNotStoredException(id)
      }
    }
  }

  fun pending(): List<String> = synchronized(UploadJobs.lock) {
    val alive = UploadJobs.scheduledStems(context) + UploadJobs.running
    for (stem in files.stems() - alive) {
      files.remove(stem)
    }
    files.stems().filter { it in alive }.map(::uploadIdOf).distinct()
  }

  fun takeResults(): List<Map<String, Any?>> = files.takeResults()

  // CAP-007-R04
  fun cancelAll() = synchronized(UploadJobs.lock) {
    UploadJobs.cancelAll(context)
    DeviceTokens.cache.clear()
  }
}

internal fun uploadIdOf(stem: String): String = stem.substringBefore(STEM_SEPARATOR)

private fun isUploadUrl(text: String): Boolean = text.toHttpUrlOrNull()?.scheme in UPLOAD_SCHEMES

private fun storedAnnouncementOf(announcement: UploadAnnouncement): StoredAnnouncement =
  StoredAnnouncement(
    announcement.url,
    announcement.body,
    announcement.headers,
    announcement.verificationUrl,
    announcement.verificationHeaders,
  )

private fun multipartTypeOf(boundary: String): String = "multipart/form-data; boundary=$boundary"
