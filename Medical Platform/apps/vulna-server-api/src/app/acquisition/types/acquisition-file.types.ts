import type { AcquisitionKind, DiscardSituation, MobileContract } from "@ansora/contracts"
import type { HpkeEnvelope } from "@ansora/core-server"
import type { EditKind } from "@ansora/vulna-domain"
import type { FileFieldsInterceptor } from "@nestjs/platform-express"
import type { StoredBinaryObject } from "../../binary-object/types/binary-object.types"
import type { AssessmentRow, BodySiteRow, FindingRow } from "../../finding/types/finding.types"
import type { FILE_KIND, FILE_STATUS } from "../constants/acquisition-file.constants"
import type { OperatorClaim } from "./acquisition.types"
import type { IssuedUploadPermission } from "./queue-sender.types"

type MobileSchemas = MobileContract.components["schemas"]

export type AcquisitionDraftFileView = MobileSchemas["AcquisitionDraftFile"]
export type AnnouncementReceiptView = MobileSchemas["AcquisitionFileAnnouncementReceipt"]
export type ImageReceiptView = MobileSchemas["ImageReceipt"]
export type DocumentPageReceiptView = MobileSchemas["DocumentPageReceipt"]
export type DocumentTitleView = MobileSchemas["DocumentTitle"]

export type FileStatus = (typeof FILE_STATUS)[keyof typeof FILE_STATUS]
export type FileKind = (typeof FILE_KIND)[keyof typeof FILE_KIND]

// datovy-model.md 2, CAP-015-R35, CAP-015-R36, CAP-015-R34
export interface AcquisitionFileRow {
	id: string
	file_key: string
	sequence: number
	proposed_sequence: number | null
	status: FileStatus
	binary_object_id: string | null
	thumbnail_binary_object_id: string | null
	sha256: string | null
	original_upload_sha256: string | null
	edit_kind: EditKind | null
	edited_at: Date | null
	announced_by_device_id: string | null
	replaces_file_id: string | null
	announced_at: Date
	received_at: Date | null
}

// CAP-014-R22, CAP-015-R29, CAP-015-R35
export interface FileCountRow {
	acquisition_id: string
	held: number
	received: number
	announced: number
	rejected: number
	announced_elsewhere: number
}

export interface ReceivedFileKeyRow {
	acquisition_id: string
	file_key: string
}

export interface ReceivedCountRow {
	acquisition_id: string
	received: number
}

// datovy-model.md 2, CAP-018-R15
export interface DocumentTitleFields {
	title_code: string | null
	title_text: string | null
	title_code_list_version: number | null
}

// datovy-model.md 2
export interface DocumentRow extends DocumentTitleFields {
	id: string
	acquisition_id: string
}

// CAP-018-R15
export interface DocumentTitleChoice {
	code: string | null
	text: string | null
	codeListVersion: number | null
}

// CAP-015-R35, CAP-015-R36
export interface NewAnnouncedFile {
	id: string
	acquisitionId: string
	kind: AcquisitionKind
	fileKey: string
	sequence: number
	proposedSequence: number | null
	deviceId: string
	replacesFileId: string | null
	announcedAt: Date
}

// CAP-019-R24, CAP-021-R35
export interface ReceivedContent {
	binaryObjectId: string
	thumbnailBinaryObjectId: string | undefined
	sha256: string
	receivedAt: Date
}

// CAP-015-R34, CAP-026-R17
export interface ReplacedContent {
	binaryObjectId: string
	thumbnailBinaryObjectId: string | undefined
	sha256: string
	editKind: EditKind
	editedAt: Date
}

// clinical-workflow.yaml AcquisitionFileAnnouncement
export interface FileAnnouncement {
	acquisitionId: string
	fileKey: string
	fileKind: FileKind
	// ADR-014
	sha256: string
	proposedSequence: number | undefined
	replacesFileKey: string | undefined
}

export type NewFileRequest = Pick<FileAnnouncement, "fileKey" | "proposedSequence" | "replacesFileKey">

export interface AnnouncementResult {
	created: boolean
	file: AcquisitionDraftFileView
	// ADR-014
	permission: IssuedUploadPermission
}

export interface UploadedPart {
	buffer: Buffer
	size: number
}

export type UploadedParts = Record<string, UploadedPart[] | undefined>

// clinical-workflow.yaml ImageUpload, DocumentPageUpload, AcquisitionFileReplacement
export type MultipartPart = Parameters<typeof FileFieldsInterceptor>[0][number]

// clinical-workflow.yaml ImageUpload.encryption, thumbnail_encryption
export interface EnvelopeFields {
	encryption?: HpkeEnvelope | undefined
	thumbnail_encryption?: HpkeEnvelope | undefined
}

// CAP-021-R21, CAP-009-R13
export interface SealedContent {
	file: Buffer
	thumbnail: Buffer | undefined
	encryption: HpkeEnvelope | undefined
	thumbnailEncryption: HpkeEnvelope | undefined
}

export interface OpenedContent {
	file: Buffer
	thumbnail: Buffer | undefined
}

// CAP-021-R35, CAP-026-R14
export interface StoredContent {
	file: StoredBinaryObject
	thumbnail: StoredBinaryObject | undefined
}

// ADR-015, CAP-021-R07, integrace-dicom.md 3.1, clinical-workflow.yaml ImageUpload, DocumentPageUpload
export interface ContentCheck {
	sha256: string
	kind: AcquisitionKind
}

// clinical-workflow.yaml ImageUpload, DocumentPageUpload
export interface FileUpload {
	acquisitionId: string
	fileKey: string
	kind: AcquisitionKind
	sha256: string
	proposedSequence: number
	content: SealedContent
}

// clinical-workflow.yaml AcquisitionFileReplacement
export interface FileReplacement {
	acquisitionId: string
	fileKey: string
	version: number
	sha256: string
	edit: EditKind
	content: SealedContent
}

// CAP-015-R34, CAP-026-R17
export interface ReplacementOutcome {
	file: AcquisitionFileRow
	discardedObjectIds: string[]
}

// CAP-021-R29, CAP-021-R35, CAP-026-R14
export interface KeptContent<Result> {
	result: Result
	isContentKept: boolean
}

export interface FileRemoval {
	acquisitionId: string
	fileKey: string
	version: number
}

export interface FileOrder {
	acquisitionId: string
	version: number
	fileKeys: readonly string[]
}

// clinical-workflow.yaml AcquisitionClosure
export interface ClosureRequest {
	acquisitionId: string
	version: number
	fileCount: number | undefined
	completedAt: Date
	operator: OperatorClaim
}

// CAP-021-R22, CAP-021-R27, CAP-018-R15
export interface ClosingContent {
	finding: FindingRow | undefined
	site: BodySiteRow | undefined
	assessment: AssessmentRow | undefined
	document: DocumentRow | undefined
}

export interface DiscardRequest {
	acquisitionId: string
	version: number
	situation: DiscardSituation
}

// CAP-015-R17, CAP-015-R37
export interface RemovedDraft {
	discardedFileCount: number
	binaryObjectIds: string[]
}
