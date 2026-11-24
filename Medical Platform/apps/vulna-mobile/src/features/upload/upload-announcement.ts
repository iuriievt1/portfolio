import { AUTHORIZATION_HEADER, BEARER_PREFIX, IDEMPOTENCY_KEY_HEADER, OPERATOR_ID_HEADER } from "@ansora/contracts"
import type { UploadAnnouncement } from "@ansora/core-mobile"
import { type AcquisitionFileAnnouncement, announcementPathOf } from "../../api/acquisition-files"
import { apiUrlOf, plainRequestHeaders } from "../../api/client"
import { VERIFICATION_PATH } from "../../api/device"

interface AnnouncedFile {
	acquisitionId: string
	fileKey: string
	operatorUserId: string
	announcement: AcquisitionFileAnnouncement
}

// clinical-workflow.yaml uploadImage, uploadDocumentPage, index.yaml FileIdempotencyKey
export function uploadHeadersOf(fileKey: string): Record<string, string> {
	return { ...plainRequestHeaders(), [IDEMPOTENCY_KEY_HEADER]: fileKey }
}

// ADR-014
export function permittedUploadHeadersOf(fileKey: string, uploadPermission: string): Record<string, string> {
	return { ...uploadHeadersOf(fileKey), [AUTHORIZATION_HEADER]: `${BEARER_PREFIX}${uploadPermission}` }
}

// ADR-014, CAP-019-R32, CAP-002-R09, CAP-025-R17
export function uploadAnnouncementOf(file: AnnouncedFile): UploadAnnouncement {
	return {
		url: apiUrlOf(announcementPathOf(file.acquisitionId)),
		body: JSON.stringify(file.announcement),
		headers: { ...uploadHeadersOf(file.fileKey), [OPERATOR_ID_HEADER]: file.operatorUserId },
		verificationUrl: apiUrlOf(VERIFICATION_PATH),
		verificationHeaders: plainRequestHeaders(),
	}
}
