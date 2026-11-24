import { ERROR_CODE, type ErrorCode, RETRY_AFTER_HEADER } from "@ansora/contracts"
import { HttpStatus } from "@nestjs/common"
import { ProblemException } from "../../infra/exceptions/problem.exception"

const STATUS_OF_CODE: Partial<Record<ErrorCode, HttpStatus>> = {
	[ERROR_CODE.PROVIDER_UNAVAILABLE]: HttpStatus.SERVICE_UNAVAILABLE,
	[ERROR_CODE.LOGIN_INCOMPLETE]: HttpStatus.CONFLICT,
	[ERROR_CODE.PIN_SETUP_REQUIRED]: HttpStatus.BAD_REQUEST,
	[ERROR_CODE.METHOD_DISABLED]: HttpStatus.FORBIDDEN,
	[ERROR_CODE.FULL_LOGIN_REQUIRED]: HttpStatus.FORBIDDEN,
	[ERROR_CODE.CARD_BINDING_CODE_INVALID]: HttpStatus.FORBIDDEN,
	[ERROR_CODE.CARD_BINDING_DISABLED]: HttpStatus.FORBIDDEN,
	[ERROR_CODE.CARD_ALREADY_BOUND]: HttpStatus.CONFLICT,
	[ERROR_CODE.RECORD_REJECTED]: HttpStatus.BAD_REQUEST,
}

export function signInAgain(): ProblemException {
	return new ProblemException(HttpStatus.UNAUTHORIZED, ERROR_CODE.SIGN_IN_AGAIN)
}

export function loginRejection(code: ErrorCode, retryAfterSeconds?: number): ProblemException {
	const headers: Record<string, string> = {}
	if (retryAfterSeconds !== undefined) {
		headers[RETRY_AFTER_HEADER] = String(retryAfterSeconds)
	}
	return new ProblemException(STATUS_OF_CODE[code] ?? HttpStatus.UNAUTHORIZED, code, undefined, headers)
}
