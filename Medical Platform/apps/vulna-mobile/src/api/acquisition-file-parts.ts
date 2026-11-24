import type { MobileContract } from "@ansora/contracts"
import type { HpkeEnvelope } from "@ansora/core-mobile"

type Schemas = MobileContract.components["schemas"]
type UploadPartName =
	| keyof Schemas["ImageUpload"]
	| keyof Schemas["DocumentPageUpload"]
	| keyof Schemas["AcquisitionFileReplacement"]
type CollectionOf<Path> = Path extends `/acquisitions/{acquisitionId}/${infer Collection}` ? Collection : never
type AcquisitionCollection = CollectionOf<keyof MobileContract.paths>

// clinical-workflow.yaml ImageUpload, DocumentPageUpload, AcquisitionFileReplacement
export const FILE_UPLOAD_PART = {
	IMAGE: "image",
	PAGE: "page",
	FILE: "file",
	THUMBNAIL: "thumbnail",
	ENCRYPTION: "encryption",
	THUMBNAIL_ENCRYPTION: "thumbnail_encryption",
	SHA256: "sha256",
	SEQUENCE: "sequence",
	IS_LAST: "is_last",
	EDIT: "edit",
} as const satisfies Record<string, UploadPartName>

export type FileUploadPart = (typeof FILE_UPLOAD_PART)[keyof typeof FILE_UPLOAD_PART]

// clinical-workflow.yaml uploadImage, uploadDocumentPage
export const FILE_UPLOAD_COLLECTION = {
	IMAGES: "images",
	DOCUMENTS: "documents",
} as const satisfies Record<string, AcquisitionCollection>

export type FileUploadCollection = (typeof FILE_UPLOAD_COLLECTION)[keyof typeof FILE_UPLOAD_COLLECTION]

const JSON_PART = "application/json"
const SEALED_PART = "application/octet-stream"

export interface SealedPart {
	path: string
	envelope: HpkeEnvelope
}

// CAP-009-R13, CAP-021-R21
export interface SealedFile {
	file: SealedPart
	thumbnail: SealedPart
	sha256: string
}

export interface MultipartField {
	name: FileUploadPart
	value: string
	contentType?: string
}

interface MultipartFile {
	name: FileUploadPart
	path: string
	filename: string
	contentType: string
}

// CAP-009-R13, CAP-021-R21, ADR-015
export function sealedFieldsOf(sealed: SealedFile): MultipartField[] {
	return [
		{ name: FILE_UPLOAD_PART.ENCRYPTION, value: JSON.stringify(sealed.file.envelope), contentType: JSON_PART },
		{
			name: FILE_UPLOAD_PART.THUMBNAIL_ENCRYPTION,
			value: JSON.stringify(sealed.thumbnail.envelope),
			contentType: JSON_PART,
		},
		{ name: FILE_UPLOAD_PART.SHA256, value: sealed.sha256 },
	]
}

// CAP-009-R13, CAP-021-R21, ADR-015
export function sealedFilesOf(sealed: SealedFile, contentPart: FileUploadPart, fileKey: string): MultipartFile[] {
	return [
		{ name: contentPart, path: sealed.file.path, filename: fileKey, contentType: SEALED_PART },
		{ name: FILE_UPLOAD_PART.THUMBNAIL, path: sealed.thumbnail.path, filename: fileKey, contentType: SEALED_PART },
	]
}
