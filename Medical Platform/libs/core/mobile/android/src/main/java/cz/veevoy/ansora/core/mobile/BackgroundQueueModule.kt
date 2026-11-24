package cz.veevoy.ansora.core.mobile

import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

private const val UPLOAD_FINISHED_EVENT = "uploadFinished"
private const val UPLOAD_FAILED_EVENT = "uploadFailed"
private const val ANNOUNCES_FILES = "announcesFiles"

class UploadField : Record {
  @Field var name: String = ""
  @Field var value: String = ""
  @Field var contentType: String? = null
}

class UploadFile : Record {
  @Field var name: String = ""
  @Field var path: String = ""
  @Field var filename: String = ""
  @Field var contentType: String = "application/octet-stream"
}

class UploadAnnouncement : Record {
  @Field var url: String = ""
  @Field var body: String = ""
  @Field var headers: Map<String, String> = emptyMap()
  @Field var verificationUrl: String = ""
  @Field var verificationHeaders: Map<String, String> = emptyMap()
}

class UploadRequest : Record {
  @Field var id: String = ""
  @Field var url: String = ""
  @Field var headers: Map<String, String> = emptyMap()
  @Field var fields: List<UploadField> = emptyList()
  @Field var files: List<UploadFile> = emptyList()
  @Field var announcement: UploadAnnouncement? = null
  @Field var delayMs: Double = 0.0
}

class UploadIdInvalidException(id: String) :
  CodedException("upload-id-invalid", "The upload id $id is not a short name of letters, digits, dash and underscore", null)

class UploadUrlInvalidException(url: String) :
  CodedException("upload-url-invalid", "The upload address $url is not an http(s) address with a host", null)

class UploadFileMissingException(path: String) :
  CodedException("upload-file-missing", "The file to upload is not readable at $path", null)

class UploadDelayInvalidException(delayMs: Double) :
  CodedException("upload-delay-invalid", "The upload delay $delayMs ms is not between zero and an hour", null)

class UploadNotScheduledException(id: String) :
  CodedException("upload-not-scheduled", "The system refused to schedule the upload $id", null)

class UploadNotStoredException(id: String) :
  CodedException("upload-not-stored", "The upload $id could not be stored for the system", null)

// NAB-205, NAB-412, CAP-019-R09, CAP-010-R08
class BackgroundQueueModule : Module() {
  private val transfer by lazy {
    BackgroundTransfer(appContext.reactContext ?: throw Exceptions.ReactContextLost())
  }

  override fun definition() = ModuleDefinition {
    Name("BackgroundQueue")

    Events(UPLOAD_FINISHED_EVENT, UPLOAD_FAILED_EVENT)

    // ADR-014
    Constant(ANNOUNCES_FILES) { true }

    OnCreate {
      UploadEvents.listener = { result ->
        sendEvent(if (result.failure == null) UPLOAD_FINISHED_EVENT else UPLOAD_FAILED_EVENT, result.payload())
      }
    }

    OnDestroy {
      UploadEvents.listener = null
    }

    AsyncFunction("upload") { request: UploadRequest ->
      transfer.start(request)
    }

    AsyncFunction("grant") { id: String, permission: String ->
      transfer.grant(id, permission)
    }

    AsyncFunction("pending") {
      transfer.pending()
    }

    AsyncFunction("takeResults") {
      transfer.takeResults()
    }

    // CAP-007-R04
    AsyncFunction("cancelAll") {
      transfer.cancelAll()
    }
  }
}

internal enum class UploadStage(val wire: String) {
  ANNOUNCEMENT("announcement"),
  UPLOAD("upload"),
}

internal data class UploadResult(
  val id: String,
  val stage: UploadStage,
  val status: Int?,
  val body: String?,
  val failure: String?,
  val code: Int?,
) {
  fun payload(): Map<String, Any?> =
    mapOf("id" to id, "stage" to stage.wire, "status" to status, "body" to body, "failure" to failure, "code" to code)
}

internal object UploadEvents {
  @Volatile var listener: ((UploadResult) -> Unit)? = null

  fun deliver(result: UploadResult) {
    listener?.invoke(result)
  }
}
