import { ERROR_CODE } from "@ansora/contracts"
import { HttpStatus } from "@nestjs/common"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { PART } from "../constants/acquisition-file.constants"
import type { EnvelopeFields, SealedContent, UploadedPart, UploadedParts } from "../types/acquisition-file.types"

function malformed(detail: string): ProblemException {
	return new ProblemException(HttpStatus.BAD_REQUEST, ERROR_CODE.RECORD_REJECTED, detail)
}

function onlyPartOf(parts: UploadedParts | undefined, name: string): UploadedPart | undefined {
	const [part] = parts?.[name] ?? []
	return part
}

// clinical-workflow.yaml ImageUpload, DocumentPageUpload, AcquisitionFileReplacement, CAP-021-R21
export function sealedContentOf(
	parts: UploadedParts | undefined,
	filePart: string,
	fields: EnvelopeFields,
): SealedContent {
	const file = onlyPartOf(parts, filePart)
	if (file === undefined) {
		throw malformed(`the part ${filePart} is missing`)
	}
	const thumbnail = onlyPartOf(parts, PART.THUMBNAIL)
	const encryption = fields.encryption
	const thumbnailEncryption = fields.thumbnail_encryption
	if (thumbnailEncryption !== undefined && (thumbnail === undefined || encryption === undefined)) {
		throw malformed("thumbnail_encryption needs thumbnail and encryption")
	}
	if (encryption !== undefined && thumbnail !== undefined && thumbnailEncryption === undefined) {
		throw malformed("an encrypted upload needs thumbnail_encryption for its thumbnail")
	}
	return { file: file.buffer, thumbnail: thumbnail?.buffer, encryption, thumbnailEncryption }
}

// konfigurace-a-profily.md 2.7, CAP-015-R13
export function sealedSizeOf(content: SealedContent): number {
	return content.file.length + (content.thumbnail?.length ?? 0)
}

export function textFieldsOf(body: unknown): Record<string, unknown> {
	return typeof body === "object" && body !== null ? { ...body } : {}
}
