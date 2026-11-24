import type { BufferedFileKind, UploadAnnouncement, UploadRequest } from "@ansora/core-mobile"
import {
	FILE_UPLOAD_COLLECTION,
	FILE_UPLOAD_PART,
	type FileUploadCollection,
	type FileUploadPart,
	type MultipartField,
	type SealedFile,
	sealedFieldsOf,
	sealedFilesOf,
} from "../../api/acquisition-file-parts"

// clinical-workflow.yaml DocumentPageUpload is_last, CAP-021-R25
const NOT_LAST_PAGE = String(false)

interface SealedUpload {
	fileKey: string
	kind: BufferedFileKind
	sequence: number
	url: string
	headers: Readonly<Record<string, string>>
	sealed: SealedFile
	announcement: UploadAnnouncement | null
	delayMs: number
}

interface KindOfUpload {
	collection: FileUploadCollection
	contentPart: FileUploadPart
	kindFields: readonly MultipartField[]
}

// clinical-workflow.yaml uploadImage, uploadDocumentPage
const UPLOAD_OF_KIND: Readonly<Record<BufferedFileKind, KindOfUpload>> = {
	image: { collection: FILE_UPLOAD_COLLECTION.IMAGES, contentPart: FILE_UPLOAD_PART.IMAGE, kindFields: [] },
	document_page: {
		collection: FILE_UPLOAD_COLLECTION.DOCUMENTS,
		contentPart: FILE_UPLOAD_PART.PAGE,
		kindFields: [{ name: FILE_UPLOAD_PART.IS_LAST, value: NOT_LAST_PAGE }],
	},
}

// clinical-workflow.yaml uploadImage, uploadDocumentPage
export function uploadCollectionOf(kind: BufferedFileKind): FileUploadCollection {
	return UPLOAD_OF_KIND[kind].collection
}

// CAP-009-R13, CAP-021-R21, CAP-015-R35, ADR-015
export function uploadRequestOf(upload: SealedUpload): UploadRequest {
	const { contentPart, kindFields } = UPLOAD_OF_KIND[upload.kind]
	return {
		id: upload.fileKey,
		url: upload.url,
		headers: upload.headers,
		fields: [
			...sealedFieldsOf(upload.sealed),
			{ name: FILE_UPLOAD_PART.SEQUENCE, value: String(upload.sequence) },
			...kindFields,
		],
		files: sealedFilesOf(upload.sealed, contentPart, upload.fileKey),
		announcement: upload.announcement,
		delayMs: upload.delayMs,
	}
}
