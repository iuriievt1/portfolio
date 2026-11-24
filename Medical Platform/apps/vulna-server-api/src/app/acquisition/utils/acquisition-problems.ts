import { ERROR_CODE } from "@ansora/contracts"
import { HttpStatus } from "@nestjs/common"
import { ProblemException } from "../../infra/exceptions/problem.exception"

export function notFound(): ProblemException {
	return new ProblemException(HttpStatus.NOT_FOUND, ERROR_CODE.RESOURCE_NOT_FOUND)
}

// CAP-014-R07, CAP-021-R29
export function closed(): ProblemException {
	return new ProblemException(HttpStatus.CONFLICT, ERROR_CODE.ACQUISITION_CLOSED)
}

// CAP-019-R14
export function alreadyDecided(): ProblemException {
	return new ProblemException(HttpStatus.CONFLICT, ERROR_CODE.ACQUISITION_ALREADY_DECIDED)
}

// CAP-021-R32
export function versionConflict(): ProblemException {
	return new ProblemException(HttpStatus.CONFLICT, ERROR_CODE.ACQUISITION_VERSION_CONFLICT)
}

// CAP-021-R29
export function idempotencyConflict(): ProblemException {
	return new ProblemException(HttpStatus.CONFLICT, ERROR_CODE.IDEMPOTENCY_CONFLICT)
}

// CAP-019-R14
export function rejected(detail: string): ProblemException {
	return new ProblemException(HttpStatus.UNPROCESSABLE_ENTITY, ERROR_CODE.RECORD_REJECTED, detail)
}

// CAP-015-R13, CAP-018-R12
export function tooLarge(detail: string): ProblemException {
	return new ProblemException(HttpStatus.PAYLOAD_TOO_LARGE, ERROR_CODE.RECORD_REJECTED, detail)
}

// CAP-015-R37, CAP-015-S55
export function hasFiles(): ProblemException {
	return new ProblemException(HttpStatus.CONFLICT, ERROR_CODE.ACQUISITION_HAS_FILES)
}
