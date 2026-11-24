import {
	ACQUISITION_VERSION_HEADER,
	IDEMPOTENCY_KEY_HEADER,
	type MobileContract,
	OPERATOR_ID_HEADER,
} from "@ansora/contracts"
import {
	FILE_UPLOAD_PART,
	type FileUploadCollection,
	type SealedFile,
	sealedFieldsOf,
	sealedFilesOf,
} from "./acquisition-file-parts"
import { type AcquisitionDraft, draftPath, versionTagOf } from "./acquisitions"
import { ACCEPTS_OUTDATED_APP, callApi } from "./client"
import { type MultipartBody, sendMultipart } from "./file-transfer"

type Schemas = MobileContract.components["schemas"]

export type AcquisitionDraftFile = Schemas["AcquisitionDraftFile"]
export type AcquisitionFileAnnouncement = Schemas["AcquisitionFileAnnouncement"]
export type AcquisitionFileAnnouncementReceipt = Schemas["AcquisitionFileAnnouncementReceipt"]
type FileEdit = Schemas["AcquisitionFileReplacement"]["edit"]
type DraftVersion = Pick<AcquisitionDraft, "acquisition_id" | "version">

// CAP-015-R34, CAP-021-R34
export interface FileReplacement extends SealedFile {
	edit: FileEdit
}

// CAP-002-R09
function operatorHeaderOf(operatorUserId: string | undefined): Record<string, string> {
	return operatorUserId === undefined ? {} : { [OPERATOR_ID_HEADER]: operatorUserId }
}

function filePath(acquisitionId: string, fileKey: string): string {
	return `${draftPath(acquisitionId)}/files/${encodeURIComponent(fileKey)}`
}

// clinical-workflow.yaml announceAcquisitionFile
export function announcementPathOf(acquisitionId: string): string {
	return `${draftPath(acquisitionId)}/files`
}

// clinical-workflow.yaml uploadImage, uploadDocumentPage
export function uploadPathOf(acquisitionId: string, collection: FileUploadCollection): string {
	return `${draftPath(acquisitionId)}/${collection}`
}

// CAP-015-R34, CAP-021-R21
function replacementBody(replacement: FileReplacement, fileKey: string): MultipartBody {
	return {
		texts: [...sealedFieldsOf(replacement), { name: FILE_UPLOAD_PART.EDIT, value: replacement.edit }],
		files: sealedFilesOf(replacement, FILE_UPLOAD_PART.FILE, fileKey),
	}
}

export const acquisitionFileApi = {
	// CAP-015-R35, CAP-015-R36, CAP-021-R29, CAP-002-R09, ADR-014, CAP-012-R25
	announceAcquisitionFile: (
		accessToken: string,
		acquisitionId: string,
		fileKey: string,
		announcement: AcquisitionFileAnnouncement,
		operatorUserId: string | undefined,
	): Promise<AcquisitionFileAnnouncementReceipt> =>
		callApi<AcquisitionFileAnnouncementReceipt>(announcementPathOf(acquisitionId), {
			method: "POST",
			body: announcement,
			sessionToken: accessToken,
			headers: { [IDEMPOTENCY_KEY_HEADER]: fileKey, ...operatorHeaderOf(operatorUserId) },
			...ACCEPTS_OUTDATED_APP,
		}),
	// CAP-015-R18, CAP-018-R11, CAP-021-R32, CAP-012-R25
	removeAcquisitionFile: (sessionToken: string, draft: DraftVersion, fileKey: string): Promise<void> =>
		callApi<void>(filePath(draft.acquisition_id, fileKey), {
			method: "DELETE",
			sessionToken,
			headers: { [ACQUISITION_VERSION_HEADER]: versionTagOf(draft.version) },
			...ACCEPTS_OUTDATED_APP,
		}),
	// CAP-015-R34, CAP-018-R11, CAP-021-R32, CAP-012-R25
	replaceAcquisitionFile: async (
		sessionToken: string,
		draft: DraftVersion,
		fileKey: string,
		replacement: FileReplacement,
	): Promise<AcquisitionDraftFile> => {
		const response = await sendMultipart(
			"PUT",
			filePath(draft.acquisition_id, fileKey),
			sessionToken,
			{ [ACQUISITION_VERSION_HEADER]: versionTagOf(draft.version) },
			replacementBody(replacement, fileKey),
			ACCEPTS_OUTDATED_APP,
		)
		return (await response.json()) as AcquisitionDraftFile
	},
	// CAP-018-R11, CAP-015-R33, CAP-021-R32, CAP-012-R25
	setAcquisitionFileOrder: (
		sessionToken: string,
		draft: DraftVersion,
		fileKeys: readonly string[],
	): Promise<AcquisitionDraft> =>
		callApi<AcquisitionDraft>(`${draftPath(draft.acquisition_id)}/file-order`, {
			method: "PUT",
			body: { file_keys: fileKeys },
			sessionToken,
			headers: { [ACQUISITION_VERSION_HEADER]: versionTagOf(draft.version) },
			...ACCEPTS_OUTDATED_APP,
		}),
}
