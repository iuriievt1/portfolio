import { DELIVERY_INSTANCE_STATE, type DeliveryInstanceState } from "@ansora/contracts"
import {
	ARCHIVE_NOT_SENT_REASON,
	ARCHIVE_OUTCOME_CLASS,
	ARCHIVE_PHASE,
	ARCHIVE_RETRY_POLICY,
	type ArchiveClassification,
	type ArchiveQueryOutcome,
	type ArchiveStoreOutcome,
} from "@ansora/vulna-domain"
import { ARTIFACT_SOURCE_KIND } from "../../../libs/common/constants/artifact.constants"
import type { DeliveryArchive, DeliveryInstance, DeliverySettings } from "../types/delivery.types"

export const MAX_ATTEMPTS = 5
export const VERIFICATION_DELAY_SECONDS = 60
export const REJECTIONS_BEFORE_ALERT = 3
export const BACKOFF = { minimumSeconds: 60, maximumSeconds: 3600 }
export const SOP_INSTANCE_UID = "2.25.3001"
export const PATIENT_ID = "7001011234"
export const JPEG_BASELINE = "1.2.840.10008.1.2.4.50"

export function instanceOf(state: DeliveryInstanceState, change: Partial<DeliveryInstance> = {}): DeliveryInstance {
	return {
		id: "11111111-1111-4111-8111-111111111111",
		deliveryId: "22222222-2222-4222-8222-222222222222",
		state,
		attempts: 0,
		verificationRejections: 0,
		artifactId: "33333333-3333-4333-8333-333333333333",
		sourceKind: ARTIFACT_SOURCE_KIND.IMAGE,
		sopClassUid: "1.2.840.10008.5.1.4.1.1.77.1.4",
		sopInstanceUid: SOP_INSTANCE_UID,
		acquisitionId: "44444444-4444-4444-8444-444444444444",
		targetCode: "pacs",
		studyInstanceUid: "2.25.1001",
		seriesInstanceUid: "2.25.2001",
		...change,
	}
}

export const SENDING_INSTANCE = instanceOf(DELIVERY_INSTANCE_STATE.SENDING)
export const PENDING_INSTANCE = instanceOf(DELIVERY_INSTANCE_STATE.PENDING_VERIFICATION, { attempts: 1 })

function unusedArchive(): DeliveryArchive {
	const unused = async (): Promise<never> => {
		throw new Error("the archive is not used by this test")
	}
	return {
		checkAvailability: unused,
		storeImage: unused,
		storeDocument: unused,
		findInstance: unused,
		findStudyPatients: unused,
	}
}

export function settingsWith(archive: DeliveryArchive = unusedArchive()): DeliverySettings {
	return {
		archive,
		maxAttempts: MAX_ATTEMPTS,
		backoff: BACKOFF,
		verificationDelaySeconds: VERIFICATION_DELAY_SECONDS,
		rejectionsBeforeAlert: REJECTIONS_BEFORE_ALERT,
		unavailableAlertSeconds: 3600,
		transferSyntaxPreference: { image: [JPEG_BASELINE], document: [] },
	}
}

export function classification(change: Partial<ArchiveClassification>): ArchiveClassification {
	return {
		outcomeClass: ARCHIVE_OUTCOME_CLASS.SUCCESS,
		retryPolicy: ARCHIVE_RETRY_POLICY.NEVER,
		retentionAnchor: false,
		clinicalSafetyQueue: false,
		alertAdmin: false,
		pauseTarget: false,
		ruleId: "STORE.0000",
		...change,
	}
}

export function stored(statusHex: string | undefined, change: Partial<ArchiveStoreOutcome> = {}): ArchiveStoreOutcome {
	return {
		phase: ARCHIVE_PHASE.RESPONSE,
		notSentReason: undefined,
		timeout: undefined,
		statusHex,
		errorComment: undefined,
		classification: classification({ retentionAnchor: true }),
		acceptedTransferSyntax: JPEG_BASELINE,
		...change,
	}
}

export const UNREACHABLE: ArchiveStoreOutcome = stored(undefined, {
	phase: ARCHIVE_PHASE.NOT_SENT,
	notSentReason: ARCHIVE_NOT_SENT_REASON.CONNECT_FAILED,
	acceptedTransferSyntax: undefined,
	classification: classification({
		outcomeClass: ARCHIVE_OUTCOME_CLASS.TRANSIENT,
		retryPolicy: ARCHIVE_RETRY_POLICY.BACKOFF,
		ruleId: "STORE.NOT_SENT",
	}),
})

export function queried(change: Partial<ArchiveQueryOutcome>): ArchiveQueryOutcome {
	return {
		phase: ARCHIVE_PHASE.RESPONSE,
		notSentReason: undefined,
		timeout: undefined,
		statusHex: "0000",
		errorComment: undefined,
		classification: classification({ ruleId: "FIND.0000" }),
		isComplete: true,
		matchedValues: [],
		...change,
	}
}
