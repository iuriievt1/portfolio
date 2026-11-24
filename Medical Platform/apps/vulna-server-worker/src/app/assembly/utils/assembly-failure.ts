import { ClosedRecordConflictError, DicomMappingError } from "@ansora/vulna-domain"
import { MissingBufferError } from "../../clinical-record-upload/errors/missing-buffer.error"
import { TEXT_RECOGNITION_FAILURE } from "../../text-recognition/constants/text-recognition.constants"
import type { TextRecognitionFailure } from "../../text-recognition/types/text-recognition.types"
import { ASSEMBLY_FAILURE, TEXT_RECOGNITION_FAILURE_CLASS } from "../constants/assembly.constants"
import { AssemblyFailure } from "../errors/assembly-failure.error"
import type { TextRecognitionFailureClass } from "../types/assembly.types"

// CAP-022-R10, CAP-022-S03, CAP-022-S06, dorucovaci-jadro.md 5.2
export function textRecognitionFailureClassOf(failure: TextRecognitionFailure): TextRecognitionFailureClass {
	switch (failure) {
		case TEXT_RECOGNITION_FAILURE.TIMED_OUT:
		case TEXT_RECOGNITION_FAILURE.MEMORY_EXCEEDED:
		case TEXT_RECOGNITION_FAILURE.CRASHED:
		case TEXT_RECOGNITION_FAILURE.INVALID_OUTPUT:
			return TEXT_RECOGNITION_FAILURE_CLASS.DOCUMENT
		case TEXT_RECOGNITION_FAILURE.INVALID_PAGE:
			return TEXT_RECOGNITION_FAILURE_CLASS.PAGE
		case TEXT_RECOGNITION_FAILURE.MODELS_MISSING:
		case TEXT_RECOGNITION_FAILURE.START_FAILED:
		case TEXT_RECOGNITION_FAILURE.ISOLATION_FAILED:
		case TEXT_RECOGNITION_FAILURE.MEMORY_UNWATCHED:
			return TEXT_RECOGNITION_FAILURE_CLASS.ENVIRONMENT
		default:
			return failure satisfies never
	}
}

// CAP-022-R11, integrace-dicom.md 5, CAP-021-R35, ADR-054 bod 4
export function assemblyFailureOf(error: unknown): AssemblyFailure | undefined {
	if (error instanceof AssemblyFailure) {
		return error
	}
	if (error instanceof DicomMappingError) {
		return new AssemblyFailure(error.failure, error.message)
	}
	if (error instanceof MissingBufferError) {
		return new AssemblyFailure(ASSEMBLY_FAILURE.MISSING_BUFFER, error.message)
	}
	if (error instanceof ClosedRecordConflictError) {
		return new AssemblyFailure(ASSEMBLY_FAILURE.CLINICAL_RECORD_MISMATCH, error.message)
	}
	return undefined
}
