import type { TEXT_RECOGNITION_FAILURE } from "../constants/text-recognition.constants"

export type TextRecognitionFailure = (typeof TEXT_RECOGNITION_FAILURE)[keyof typeof TEXT_RECOGNITION_FAILURE]

// CAP-022-R02, CAP-022-R03, CAP-022-R12, ADR-005
export interface TextRecognitionSettings {
	sandboxPath: string
	tesseractPath: string
	tessdataPath: string
	timeoutMilliseconds: number
	memoryLimitBytes: number
}

// ADR-018
export type PageReader = () => Promise<Uint8Array>

export interface StoredPdfRow {
	binary_object_id: string
	size_bytes: string
	sha256: string
}

// CAP-021-R25, datovy-model.md 2
export interface DocumentPage {
	sequence: number
	binaryObjectId: string
}

export interface DocumentPageRow {
	sequence: number
	binary_object_id: string
}
