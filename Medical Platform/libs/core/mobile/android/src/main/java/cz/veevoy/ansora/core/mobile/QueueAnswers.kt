package cz.veevoy.ansora.core.mobile

private const val SUCCESS_FIRST = 200
private const val SUCCESS_LAST = 299
private const val SERVER_ERROR_FIRST = 500
private const val UNAUTHORIZED = 401
private const val REQUEST_TIMEOUT = 408
private const val TOO_MANY_REQUESTS = 429
private const val UNAVAILABLE = 503
private const val USE_DPOP_NONCE = "use_dpop_nonce"

internal enum class AnswerKind {
  SUCCESS,
  WAIT,
  RETRY,
  UNAUTHORIZED,
  FINAL,
}

// RFC 9110, CAP-019-R13, CAP-019-R18, api/README.md 5
internal fun answerKindOf(status: Int, retryAfterSeconds: Long?): AnswerKind =
  when {
    status in SUCCESS_FIRST..SUCCESS_LAST -> AnswerKind.SUCCESS
    (status == TOO_MANY_REQUESTS || status == UNAVAILABLE) && retryAfterSeconds != null -> AnswerKind.WAIT
    status == UNAUTHORIZED -> AnswerKind.UNAUTHORIZED
    status >= SERVER_ERROR_FIRST || status == REQUEST_TIMEOUT || status == TOO_MANY_REQUESTS -> AnswerKind.RETRY
    else -> AnswerKind.FINAL
  }

// RFC 9110
internal fun retryAfterSecondsOf(header: String?): Long? = header?.trim()?.toLongOrNull()?.takeIf { it >= 0 }

// RFC 9449
internal fun isNonceChallenge(status: Int, wwwAuthenticate: String?): Boolean =
  status == UNAUTHORIZED && wwwAuthenticate?.contains("error=\"$USE_DPOP_NONCE\"") == true
