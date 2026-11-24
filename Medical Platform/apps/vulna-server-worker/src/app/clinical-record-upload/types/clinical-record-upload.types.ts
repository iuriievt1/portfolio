import type { ClaimedQueueTask, DurableBinaryStorePort } from "@ansora/core-server"
import type {
	UPLOAD_ALERT_KIND,
	UPLOAD_JOB_KIND,
	UPLOAD_OBJECT_KINDS,
} from "../constants/clinical-record-upload.constants"
import type { ViewingCopySettings } from "../utils/viewing-copy"

export type UploadJobKind = (typeof UPLOAD_JOB_KIND)[keyof typeof UPLOAD_JOB_KIND]

export type UploadObjectKindOf<Kind extends UploadJobKind> = (typeof UPLOAD_OBJECT_KINDS)[Kind][number]

// CAP-021-R36, CAP-021-R39, datovy-model.md 4
export type FileObjectKind = UploadObjectKindOf<typeof UPLOAD_JOB_KIND.BINARY_UPLOAD>

// CAP-021-R40, datovy-model.md 4
export type CopiedObjectKind = UploadObjectKindOf<typeof UPLOAD_JOB_KIND.VIEWING_COPY>

export type ClaimedUploadTask<ObjectKind extends FileObjectKind = FileObjectKind> = ClaimedQueueTask<ObjectKind>

// datovy-model.md 4 „Binární objekt“
export interface StoredRendition {
	binaryObjectId: string
	sizeBytes: number
	sha256: string
	clinicalRecordBinaryId: string | null
	isUploaded: boolean
}

export interface RenditionRow {
	binary_object_id: string
	size_bytes: number
	sha256: string
	clinical_record_binary_id: string | null
	clinical_record_uploaded_at: string | null
}

export interface FileBinariesRow {
	file_id: string
	record_id: string
	encounter_resource_id: string | null
	original: RenditionRow
	thumbnail: RenditionRow | null
	viewing_copy: RenditionRow | null
}

// CAP-021-R36, CAP-021-R39, CAP-021-R40
export interface FileBinaries<ObjectKind extends FileObjectKind = FileObjectKind> {
	kind: ObjectKind
	fileId: string
	recordId: string
	ownerReference: string | undefined
	original: StoredRendition
	thumbnail: StoredRendition | undefined
	viewingCopy: StoredRendition | undefined
}

// CAP-021-R36, CAP-021-R40, CAP-028-R15
export type AlertedFile<ObjectKind extends FileObjectKind = FileObjectKind> = Pick<
	FileBinaries<ObjectKind>,
	"kind" | "fileId" | "recordId"
>

// CAP-021-R36, CAP-012-R30
export interface ConnectedStore {
	baseUrl: string
	clientId: string
	store: DurableBinaryStorePort
}

export type UploadAlertKind = (typeof UPLOAD_ALERT_KIND)[keyof typeof UPLOAD_ALERT_KIND]

export interface RaisedUploadAlert {
	alertId: string
	kind: UploadAlertKind
	message: string
	taskId: string
	file: AlertedFile
}

// CAP-021-R40
export interface ViewingCopyJob {
	original: Uint8Array
	settings: ViewingCopySettings
}
