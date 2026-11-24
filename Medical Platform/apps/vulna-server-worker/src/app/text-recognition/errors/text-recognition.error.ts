import type { TextRecognitionFailure } from "../types/text-recognition.types"

// CAP-022-R10, ADR-018
export class TextRecognitionError extends Error {
	constructor(
		readonly failure: TextRecognitionFailure,
		message: string,
	) {
		super(message)
		this.name = "TextRecognitionError"
	}
}
