import type { DicomIdentifier } from "./contract"

// integrace-dicom.md 6.4
const SPECIFIC_CHARACTER_SET = "SpecificCharacterSet"
const LIBRARY_KEY_PREFIX = "_"

function plainValueOf(value: unknown): unknown {
	if (value instanceof ArrayBuffer) {
		return Buffer.from(value).toString("base64")
	}
	if (ArrayBuffer.isView(value)) {
		return Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString("base64")
	}
	if (Array.isArray(value)) {
		return value.map(plainValueOf)
	}
	if (typeof value === "object" && value !== null) {
		return plainObjectOf(value as Record<string, unknown>)
	}
	return value
}

function plainObjectOf(elements: Record<string, unknown>, omitted?: string): Record<string, unknown> {
	const plain: Record<string, unknown> = {}
	for (const [keyword, value] of Object.entries(elements)) {
		if (!keyword.startsWith(LIBRARY_KEY_PREFIX) && keyword !== omitted) {
			plain[keyword] = plainValueOf(value)
		}
	}
	return plain
}

// integrace-dicom.md 6, 6.4, ADR-017 (?)
export function identifierJsonOf(elements: Record<string, unknown>): DicomIdentifier {
	return plainObjectOf(elements, SPECIFIC_CHARACTER_SET)
}
