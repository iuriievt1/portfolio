package cz.veevoy.ansora.core.mobile

import android.content.Context
import android.util.Log
import java.io.File
import java.io.IOException
import javax.net.ssl.SSLException
import okhttp3.Call
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONException
import org.json.JSONObject

private const val LOG_TAG = "BackgroundQueue"
private const val CERTIFICATE_FAILURE = "certificate"
private const val POST = "POST"
private const val JSON_TYPE = "application/json"
private const val NO_BODY = ""
private const val MILLISECONDS_PER_SECOND = 1_000L
private const val TOKEN_ATTEMPTS = 2

// RFC 9110, RFC 6750, RFC 9449
private const val RETRY_AFTER_HEADER = "Retry-After"
private const val AUTHORIZATION_HEADER = "Authorization"
private const val BEARER_PREFIX = "Bearer "
private const val DPOP_HEADER = "DPoP"
private const val DPOP_NONCE_HEADER = "DPoP-Nonce"
private const val WWW_AUTHENTICATE_HEADER = "WWW-Authenticate"

// clinical-workflow.yaml AcquisitionFileAnnouncementReceipt, identity.yaml DeviceState
private const val FILE_KEY = "file"
private const val STATUS_KEY = "status"
private const val ANNOUNCED = "announced"
private const val PERMISSION_KEY = "upload_permission"
private const val DEVICE_TOKEN_KEY = "device_token"
private const val DEVICE_TOKEN_EXPIRY_KEY = "device_token_expires_at"

internal data class Answer(
  val status: Int,
  val body: String?,
  val retryAfterSeconds: Long?,
  val wwwAuthenticate: String?,
) {
  val kind: AnswerKind get() = answerKindOf(status, retryAfterSeconds)
}

private sealed interface Credential {
  data class Issued(val token: String) : Credential

  data object Settled : Credential

  data object Retry : Credential
}

private sealed interface Announced {
  data class Granted(val permission: String) : Announced

  data object Settled : Announced

  data object Retry : Announced
}

private enum class Sent(val needsRetry: Boolean) {
  SETTLED(false),
  RETRY(true),
  PERMISSION_VOID(true),
}

// NAB-205, NAB-412, ADR-014, CAP-019-R13, CAP-019-R24, CAP-010-R08
internal class UploadAttempt(context: Context, private val started: (Call) -> Unit) {
  private val context = context.applicationContext
  private val files = UploadFiles(this.context)
  private val proofs by lazy { DeviceProofs(DeviceKey()) }

  fun send(stem: String): Boolean {
    if (UploadJobs.isClosed) {
      return false
    }
    val stored = files.readRequest(stem)
    val url = stored?.url?.toHttpUrlOrNull()
    val body = files.body(stem)
    if (stored == null || url == null || !body.isFile) {
      files.remove(stem)
      return false
    }
    return try {
      deliver(stem, stored, url, body)
    } catch (failure: SSLException) {
      finish(stem, UploadResult(stored.id, UploadStage.UPLOAD, null, null, CERTIFICATE_FAILURE, null))
      false
    } catch (failure: IOException) {
      true
    }
  }

  // ADR-014, CAP-019-R32
  private fun deliver(stem: String, stored: StoredRequest, url: HttpUrl, body: File): Boolean {
    val announcement = stored.announcement ?: return upload(stem, stored, url, body, null, false).needsRetry
    stored.permission?.let { permission ->
      val sent = upload(stem, stored, url, body, permission, true)
      if (sent != Sent.PERMISSION_VOID) {
        return sent.needsRetry
      }
      files.writeRequest(stem, stored.copy(permission = null))
    }
    return when (val announced = announce(stem, stored, announcement, body.length())) {
      is Announced.Granted -> {
        files.writeRequest(stem, stored.copy(permission = announced.permission))
        upload(stem, stored, url, body, announced.permission, false).needsRetry
      }
      Announced.Settled -> false
      Announced.Retry -> true
    }
  }

  // CAP-019-R24, CAP-019-R32
  private fun upload(
    stem: String,
    stored: StoredRequest,
    url: HttpUrl,
    body: File,
    permission: String?,
    canAnnounceAgain: Boolean,
  ): Sent {
    val request = Request.Builder().url(url).post(body.asRequestBody(stored.contentType.toMediaType()))
    for ((name, value) in stored.headers) {
      request.header(name, value)
    }
    permission?.let { request.header(AUTHORIZATION_HEADER, BEARER_PREFIX + it) }
    val answer = execute(request.build())
    return when (answer.kind) {
      AnswerKind.WAIT -> if (waited(stem, body.length(), answer)) Sent.SETTLED else Sent.RETRY
      AnswerKind.RETRY -> Sent.RETRY
      AnswerKind.UNAUTHORIZED -> if (canAnnounceAgain) Sent.PERMISSION_VOID else settled(stem, stored, UploadStage.UPLOAD, answer)
      AnswerKind.SUCCESS, AnswerKind.FINAL -> settled(stem, stored, UploadStage.UPLOAD, answer)
    }
  }

  // CAP-019-R32, CAP-002-R09, CAP-025-R17
  private fun announce(stem: String, stored: StoredRequest, announcement: StoredAnnouncement, bodyBytes: Long): Announced {
    val url = announcement.url.toHttpUrlOrNull() ?: return Announced.Retry
    repeat(TOKEN_ATTEMPTS) {
      val token = when (val credential = deviceToken(stem, stored, announcement, bodyBytes)) {
        is Credential.Issued -> credential.token
        Credential.Settled -> return Announced.Settled
        Credential.Retry -> return Announced.Retry
      }
      val answer = provenPost(url, announcement.headers, announcement.body, token)
      when (answer.kind) {
        AnswerKind.SUCCESS -> return permissionOf(answer.body)?.let { Announced.Granted(it) }
          ?: settledAnnouncement(stem, stored, answer)
        AnswerKind.WAIT -> return if (waited(stem, bodyBytes, answer)) Announced.Settled else Announced.Retry
        AnswerKind.RETRY -> return Announced.Retry
        AnswerKind.FINAL -> return settledAnnouncement(stem, stored, answer)
        AnswerKind.UNAUTHORIZED -> DeviceTokens.cache.forget(token)
      }
    }
    return Announced.Retry
  }

  // CAP-002-R09, CAP-019-S05
  private fun deviceToken(stem: String, stored: StoredRequest, announcement: StoredAnnouncement, bodyBytes: Long): Credential {
    DeviceTokens.cache.valid()?.let { return Credential.Issued(it) }
    synchronized(DeviceTokens.issuing) {
      DeviceTokens.cache.valid()?.let { return Credential.Issued(it) }
      val url = announcement.verificationUrl.toHttpUrlOrNull() ?: return Credential.Retry
      val answer = provenPost(url, announcement.verificationHeaders, NO_BODY, null)
      return when (answer.kind) {
        AnswerKind.SUCCESS -> issuedOf(answer.body)
        AnswerKind.WAIT -> if (waited(stem, bodyBytes, answer)) Credential.Settled else Credential.Retry
        AnswerKind.RETRY, AnswerKind.UNAUTHORIZED -> Credential.Retry
        AnswerKind.FINAL -> {
          finish(stem, resultOf(stored, UploadStage.ANNOUNCEMENT, answer))
          Credential.Settled
        }
      }
    }
  }

  private fun issuedOf(body: String?): Credential {
    val json = jsonOf(body) ?: return Credential.Retry
    val token = textOf(json, DEVICE_TOKEN_KEY) ?: return Credential.Retry
    expiryMsOf(textOf(json, DEVICE_TOKEN_EXPIRY_KEY))?.let { DeviceTokens.cache.remember(token, it) }
    return Credential.Issued(token)
  }

  private fun permissionOf(body: String?): String? {
    val json = jsonOf(body) ?: return null
    val file = json.optJSONObject(FILE_KEY) ?: return null
    return if (textOf(file, STATUS_KEY) == ANNOUNCED) textOf(json, PERMISSION_KEY) else null
  }

  // RFC 9449
  private fun provenPost(url: HttpUrl, headers: Map<String, String>, body: String, accessToken: String?): Answer {
    val answer = execute(provenRequest(url, headers, body, accessToken))
    if (!isNonceChallenge(answer.status, answer.wwwAuthenticate)) {
      return answer
    }
    return execute(provenRequest(url, headers, body, accessToken))
  }

  private fun provenRequest(url: HttpUrl, headers: Map<String, String>, body: String, accessToken: String?): Request {
    val request = Request.Builder().url(url).post(body.toRequestBody(JSON_TYPE.toMediaType()))
    for ((name, value) in headers) {
      request.header(name, value)
    }
    request.header(DPOP_HEADER, proofs.of(ProofInput(POST, url, accessToken, ProofNonce.latest)))
    accessToken?.let { request.header(AUTHORIZATION_HEADER, BEARER_PREFIX + it) }
    return request.build()
  }

  private fun execute(request: Request): Answer {
    val call = BackgroundClient.client.newCall(request)
    started(call)
    return call.execute().use { response ->
      response.header(DPOP_NONCE_HEADER)?.takeIf { it.isNotEmpty() }?.let { ProofNonce.latest = it }
      Answer(
        response.code,
        response.body?.string(),
        retryAfterSecondsOf(response.header(RETRY_AFTER_HEADER)),
        response.header(WWW_AUTHENTICATE_HEADER),
      )
    }
  }

  // CAP-019-R13, RFC 9110
  private fun waited(stem: String, bodyBytes: Long, answer: Answer): Boolean {
    val seconds = answer.retryAfterSeconds ?: return false
    return try {
      UploadJobs.schedule(context, stem, bodyBytes, seconds * MILLISECONDS_PER_SECOND)
      true
    } catch (failure: UploadNotScheduledException) {
      Log.w(LOG_TAG, "upload $stem not rescheduled after Retry-After", failure)
      false
    }
  }

  private fun settled(stem: String, stored: StoredRequest, stage: UploadStage, answer: Answer): Sent {
    finish(stem, resultOf(stored, stage, answer))
    return Sent.SETTLED
  }

  private fun settledAnnouncement(stem: String, stored: StoredRequest, answer: Answer): Announced {
    finish(stem, resultOf(stored, UploadStage.ANNOUNCEMENT, answer))
    return Announced.Settled
  }

  private fun finish(stem: String, result: UploadResult) {
    if (UploadJobs.isClosed) {
      return
    }
    try {
      files.writeResult(result)
    } catch (failure: IOException) {
      Log.w(LOG_TAG, "result of upload ${result.id} not stored", failure)
    }
    files.remove(stem)
    UploadEvents.deliver(result)
  }
}

private fun resultOf(stored: StoredRequest, stage: UploadStage, answer: Answer): UploadResult =
  UploadResult(stored.id, stage, answer.status, answer.body, null, null)

private fun jsonOf(body: String?): JSONObject? =
  try {
    body?.let(::JSONObject)
  } catch (failure: JSONException) {
    null
  }

private fun textOf(json: JSONObject, key: String): String? =
  if (json.isNull(key)) null else json.optString(key).takeIf { it.isNotEmpty() }
