package cz.veevoy.ansora.core.mobile

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class QueueAnswersTest {
  @Test
  fun successIsSuccess() {
    assertEquals(AnswerKind.SUCCESS, answerKindOf(201, null))
  }

  @Test
  fun retryAfterOnTooManyRequestsWaits() {
    assertEquals(AnswerKind.WAIT, answerKindOf(429, 30))
    assertEquals(AnswerKind.WAIT, answerKindOf(503, 0))
  }

  @Test
  fun transientAnswersWithoutRetryAfterAreRetried() {
    assertEquals(AnswerKind.RETRY, answerKindOf(429, null))
    assertEquals(AnswerKind.RETRY, answerKindOf(503, null))
    assertEquals(AnswerKind.RETRY, answerKindOf(500, null))
    assertEquals(AnswerKind.RETRY, answerKindOf(408, null))
  }

  @Test
  fun unauthorizedStaysApart() {
    assertEquals(AnswerKind.UNAUTHORIZED, answerKindOf(401, null))
  }

  @Test
  fun otherClientErrorsAreFinal() {
    assertEquals(AnswerKind.FINAL, answerKindOf(403, null))
    assertEquals(AnswerKind.FINAL, answerKindOf(409, null))
    assertEquals(AnswerKind.FINAL, answerKindOf(413, 30))
  }

  @Test
  fun retryAfterReadsWholeSecondsOnly() {
    assertEquals(30L, retryAfterSecondsOf(" 30 "))
    assertNull(retryAfterSecondsOf("Wed, 21 Oct 2026 07:28:00 GMT"))
    assertNull(retryAfterSecondsOf("-1"))
    assertNull(retryAfterSecondsOf(null))
  }

  @Test
  fun nonceChallengeNeedsTheDpopError() {
    assertTrue(isNonceChallenge(401, "DPoP error=\"use_dpop_nonce\", error_description=\"nonce\""))
    assertFalse(isNonceChallenge(401, "DPoP error=\"invalid_token\""))
    assertFalse(isNonceChallenge(400, "DPoP error=\"use_dpop_nonce\""))
    assertFalse(isNonceChallenge(401, null))
  }
}
