package cz.veevoy.ansora.core.mobile

import android.content.Context
import java.io.File
import java.io.OutputStream
import org.json.JSONException
import org.json.JSONObject

private const val UPLOADS_DIRECTORY_NAME = "uploads"
private const val BODY_EXTENSION = "body"
private const val REQUEST_EXTENSION = "request"
private const val RESULT_EXTENSION = "result"
private const val LINE_BREAK = "\r\n"
private const val ID_KEY = "id"
private const val URL_KEY = "url"
private const val CONTENT_TYPE_KEY = "contentType"
private const val HEADERS_KEY = "headers"
private const val ANNOUNCEMENT_KEY = "announcement"
private const val BODY_KEY = "body"
private const val VERIFICATION_URL_KEY = "verificationUrl"
private const val VERIFICATION_HEADERS_KEY = "verificationHeaders"
private const val PERMISSION_KEY = "permission"

internal data class StoredAnnouncement(
  val url: String,
  val body: String,
  val headers: Map<String, String>,
  val verificationUrl: String,
  val verificationHeaders: Map<String, String>,
)

internal data class StoredRequest(
  val id: String,
  val url: String,
  val contentType: String,
  val headers: Map<String, String>,
  val announcement: StoredAnnouncement?,
  val permission: String?,
)

// NAB-412, CAP-019-R09
internal class UploadFiles(context: Context) {
  private val context = context.applicationContext
  private val resultsLock = Any()

  fun writeBody(stem: String, boundary: String, fields: List<UploadField>, files: List<UploadFile>): File {
    val body = file(stem, BODY_EXTENSION)
    body.outputStream().buffered().use { output ->
      for (field in fields) {
        val type = field.contentType?.let { "Content-Type: $it$LINE_BREAK" } ?: ""
        output.text("--$boundary${LINE_BREAK}Content-Disposition: form-data; name=\"${field.name}\"$LINE_BREAK$type")
        output.text(LINE_BREAK + field.value + LINE_BREAK)
      }
      for (file in files) {
        output.text(
          "--$boundary${LINE_BREAK}Content-Disposition: form-data; name=\"${file.name}\"; " +
            "filename=\"${file.filename}\"${LINE_BREAK}Content-Type: ${file.contentType}$LINE_BREAK$LINE_BREAK",
        )
        File(file.path).inputStream().use { it.copyTo(output) }
        output.text(LINE_BREAK)
      }
      output.text("--$boundary--$LINE_BREAK")
    }
    return body
  }

  fun writeRequest(stem: String, request: StoredRequest) {
    val json = JSONObject()
      .put(ID_KEY, request.id)
      .put(URL_KEY, request.url)
      .put(CONTENT_TYPE_KEY, request.contentType)
      .put(HEADERS_KEY, JSONObject(request.headers))
      .put(ANNOUNCEMENT_KEY, request.announcement?.let(::announcementJsonOf) ?: JSONObject.NULL)
      .put(PERMISSION_KEY, request.permission ?: JSONObject.NULL)
    writeAtomically(file(stem, REQUEST_EXTENSION), json.toString())
  }

  fun readRequest(stem: String): StoredRequest? {
    val source = file(stem, REQUEST_EXTENSION)
    if (!source.isFile) {
      return null
    }
    return try {
      val json = JSONObject(source.readText())
      StoredRequest(
        id = json.getString(ID_KEY),
        url = json.getString(URL_KEY),
        contentType = json.getString(CONTENT_TYPE_KEY),
        headers = headersOf(json.getJSONObject(HEADERS_KEY)),
        announcement = json.optJSONObject(ANNOUNCEMENT_KEY)?.let(::announcementOf),
        permission = if (json.isNull(PERMISSION_KEY)) null else json.getString(PERMISSION_KEY),
      )
    } catch (failure: JSONException) {
      null
    }
  }

  fun body(stem: String): File = file(stem, BODY_EXTENSION)

  fun remove(stem: String) {
    file(stem, REQUEST_EXTENSION).delete()
    file(stem, BODY_EXTENSION).delete()
  }

  fun stems(): Set<String> {
    val listed = directory().listFiles { file -> file.extension == BODY_EXTENSION || file.extension == REQUEST_EXTENSION }
    return listed.orEmpty().map { it.nameWithoutExtension }.toSet()
  }

  fun writeResult(result: UploadResult) {
    val json = JSONObject()
    for ((key, value) in result.payload()) {
      json.put(key, value ?: JSONObject.NULL)
    }
    synchronized(resultsLock) {
      writeAtomically(file(result.id, RESULT_EXTENSION), json.toString())
    }
  }

  fun takeResults(): List<Map<String, Any?>> = synchronized(resultsLock) {
    val files = directory().listFiles { file -> file.extension == RESULT_EXTENSION }.orEmpty()
    files.mapNotNull { file ->
      val json = runCatching { JSONObject(file.readText()) }.getOrNull()
      file.delete()
      json?.let { it.keys().asSequence().associateWith { key -> if (it.isNull(key)) null else it.get(key) } }
    }
  }

  private fun file(stem: String, extension: String): File = File(directory(), "$stem.$extension")

  private fun directory(): File = VaultLayout.directory(context, UPLOADS_DIRECTORY_NAME)
}

private fun announcementJsonOf(announcement: StoredAnnouncement): JSONObject =
  JSONObject()
    .put(URL_KEY, announcement.url)
    .put(BODY_KEY, announcement.body)
    .put(HEADERS_KEY, JSONObject(announcement.headers))
    .put(VERIFICATION_URL_KEY, announcement.verificationUrl)
    .put(VERIFICATION_HEADERS_KEY, JSONObject(announcement.verificationHeaders))

private fun announcementOf(json: JSONObject): StoredAnnouncement =
  StoredAnnouncement(
    url = json.getString(URL_KEY),
    body = json.getString(BODY_KEY),
    headers = headersOf(json.getJSONObject(HEADERS_KEY)),
    verificationUrl = json.getString(VERIFICATION_URL_KEY),
    verificationHeaders = headersOf(json.getJSONObject(VERIFICATION_HEADERS_KEY)),
  )

private fun headersOf(json: JSONObject): Map<String, String> = json.keys().asSequence().associateWith { json.getString(it) }

private fun OutputStream.text(value: String) {
  write(value.toByteArray(Charsets.UTF_8))
}
