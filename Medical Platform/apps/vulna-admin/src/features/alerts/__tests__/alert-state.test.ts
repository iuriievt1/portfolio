import {
	ADMINISTRATION_ERROR_CODE,
	ADMINISTRATOR_ALERT_KIND,
	BINARY_RENDITION,
	BINARY_UPLOAD_RECORD_KIND,
	type BinaryRendition,
	CLINICAL_RECORD_WRITE_OBJECT_KIND,
} from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { AdministrationApiError } from "@/api/client"
import {
	ALERT_STATE,
	ALERT_VIEW,
	alertKindText,
	alertStateOf,
	alertViewOf,
	brokenAuditRecordOf,
	isAcknowledgeable,
	isAlreadyRequeued,
	isNoLongerAcknowledgeable,
	isOrphanedObjectsAlert,
	renditionTextOf,
	requeueTaskOf,
	writeActorOf,
} from "@/features/alerts/lib/alert-state"
import type { AdministratorAlert } from "@/features/alerts/types/alert.types"

const CONFLICT = 409
const USER_ID = "22222222-2222-4222-8222-222222222222"
const TASK_ID = "33333333-3333-4333-8333-333333333333"
const DELIVERY_ID = "44444444-4444-4444-8444-444444444444"
const INSTANCE_ID = "55555555-5555-4555-8555-555555555555"
const NO_ALERTS: ReadonlySet<string> = new Set()
const NO_ACTIONS = { requeuedAlertIds: NO_ALERTS, acknowledgedAlertIds: NO_ALERTS }

const STORED_WITH_WARNING: AdministratorAlert = {
	id: "a0000000-0000-4000-8000-000000000009",
	kind: ADMINISTRATOR_ALERT_KIND.STORED_WITH_WARNING,
	raised_at: "2026-11-09T10:00:00.000Z",
	is_active: true,
	message: "PACS uložil instanci se stavem B000.",
	delivery_id: DELIVERY_ID,
	instance_id: INSTANCE_ID,
	target_code: null,
	acknowledgement: null,
}

const FAILED_WRITE: AdministratorAlert = {
	id: "a0000000-0000-4000-8000-000000000001",
	kind: ADMINISTRATOR_ALERT_KIND.CLINICAL_RECORD_WRITE_FAILED,
	raised_at: "2026-10-15T08:00:00.000Z",
	is_active: true,
	message: "Úložiště klinického záznamu nepřijalo zápis uživatele. Po odstranění příčiny zápis zopakujte.",
	clinical_record_write: { task_id: TASK_ID, object_kind: CLINICAL_RECORD_WRITE_OBJECT_KIND.ACTOR, object_id: USER_ID },
}

const FILE_ID = "55555555-5555-4555-8555-555555555555"
const RECORD_ID = "66666666-6666-4666-8666-666666666666"

const UPLOAD = {
	task_id: TASK_ID,
	record_kind: BINARY_UPLOAD_RECORD_KIND.ACQUISITION,
	record_id: RECORD_ID,
	file_id: FILE_ID,
}

const FAILED_UPLOAD: AdministratorAlert = {
	id: "a0000000-0000-4000-8000-000000000002",
	kind: ADMINISTRATOR_ALERT_KIND.CLINICAL_RECORD_BINARY_UPLOAD_FAILED,
	raised_at: "2026-10-15T08:00:00.000Z",
	is_active: true,
	message: "Úložiště klinického záznamu nepřijalo snímek.",
	clinical_record_write: null,
	clinical_record_binary_upload: UPLOAD,
}

describe("administrator alert on the alerts page", () => {
	it("CAP-021-S25 offers the requeue only while the failed write is active", () => {
		expect(requeueTaskOf(FAILED_WRITE)).toBe(TASK_ID)
		expect(requeueTaskOf({ ...FAILED_WRITE, is_active: false })).toBeUndefined()
		expect(requeueTaskOf({ ...FAILED_WRITE, kind: ADMINISTRATOR_ALERT_KIND.AUDIT_CHAIN_BROKEN })).toBeUndefined()
	})

	it("CAP-021-S25 offers the same requeue for a failed upload while it is active", () => {
		expect(requeueTaskOf(FAILED_UPLOAD)).toBe(TASK_ID)
		expect(requeueTaskOf({ ...FAILED_UPLOAD, is_active: false })).toBeUndefined()
	})

	it("CAP-021-R40 offers no requeue for a viewing copy that was not made", () => {
		const missingCopy: AdministratorAlert = {
			...FAILED_UPLOAD,
			kind: ADMINISTRATOR_ALERT_KIND.VIEWING_COPY_GENERATION_FAILED,
			clinical_record_binary_upload: { ...UPLOAD, rendition: BINARY_RENDITION.VIEWING_COPY },
		}
		expect(requeueTaskOf(missingCopy)).toBeUndefined()
	})

	it("CAP-021-R36 CAP-021-R40 names the part of the file that was not uploaded or made", () => {
		const withRendition = (rendition: BinaryRendition): AdministratorAlert => ({
			...FAILED_UPLOAD,
			clinical_record_binary_upload: { ...UPLOAD, rendition },
		})

		expect(renditionTextOf(withRendition(BINARY_RENDITION.ORIGINAL))).toBe("Část souboru: originál")
		expect(renditionTextOf(withRendition(BINARY_RENDITION.THUMBNAIL))).toBe("Část souboru: náhled")
		expect(renditionTextOf(withRendition(BINARY_RENDITION.VIEWING_COPY))).toBe("Část souboru: prohlížecí kopie")
		expect(renditionTextOf(withRendition("output_pdf"))).toBe("Část souboru: PDF dokumentu")
	})

	it("shows no part of the file when the server does not name one", () => {
		expect(renditionTextOf(FAILED_UPLOAD)).toBeUndefined()
		expect(renditionTextOf(FAILED_WRITE)).toBeUndefined()
	})

	it("CAP-021-R27 keeps a requeued alert waiting until the store accepts the write", () => {
		const requeued = { requeuedAlertIds: new Set([FAILED_WRITE.id]), acknowledgedAlertIds: NO_ALERTS }
		expect(alertStateOf(FAILED_WRITE, NO_ACTIONS)).toBe(ALERT_STATE.ACTIVE)
		expect(alertStateOf(FAILED_WRITE, requeued)).toBe(ALERT_STATE.REQUEUED)
		expect(alertStateOf({ ...FAILED_WRITE, is_active: false }, requeued)).toBe(ALERT_STATE.RESOLVED)
	})

	it("CAP-023-R12 offers to acknowledge only an active warning of a stored instance", () => {
		expect(isAcknowledgeable(STORED_WITH_WARNING)).toBe(true)
		expect(isAcknowledgeable({ ...STORED_WITH_WARNING, is_active: false })).toBe(false)
		expect(isAcknowledgeable(FAILED_WRITE)).toBe(false)
	})

	it("CAP-023-R12 shows an acknowledged warning as acknowledged, not as resolved", () => {
		const acknowledged = {
			...STORED_WITH_WARNING,
			is_active: false,
			acknowledgement: { acknowledged_at: "2026-11-09T10:15:00.000Z", acknowledged_by_user_id: USER_ID },
		}
		expect(alertStateOf(acknowledged, NO_ACTIONS)).toBe(ALERT_STATE.ACKNOWLEDGED)
		expect(alertStateOf({ ...STORED_WITH_WARNING, is_active: false }, NO_ACTIONS)).toBe(ALERT_STATE.RESOLVED)
	})

	it("shows a warning acknowledged in this view as acknowledged before the list reloads", () => {
		const actions = { requeuedAlertIds: NO_ALERTS, acknowledgedAlertIds: new Set([STORED_WITH_WARNING.id]) }
		expect(alertStateOf(STORED_WITH_WARNING, actions)).toBe(ALERT_STATE.ACKNOWLEDGED)
	})

	it("CAP-023-R12 recognises the refusal of a warning the server no longer holds active", () => {
		const notAcknowledgeable = new AdministrationApiError(CONFLICT, ADMINISTRATION_ERROR_CODE.ALERT_NOT_ACKNOWLEDGEABLE)
		expect(isNoLongerAcknowledgeable(notAcknowledgeable)).toBe(true)
		expect(isNoLongerAcknowledgeable(new AdministrationApiError(CONFLICT, ADMINISTRATION_ERROR_CODE.NOT_FOUND))).toBe(
			false,
		)
	})

	it("takes a write the server no longer holds as failed for one already requeued", () => {
		const notFailed = new AdministrationApiError(CONFLICT, ADMINISTRATION_ERROR_CODE.CLINICAL_RECORD_WRITE_NOT_FAILED)
		const other = new AdministrationApiError(CONFLICT, ADMINISTRATION_ERROR_CODE.VERSION_CONFLICT)
		expect(isAlreadyRequeued(notFailed)).toBe(true)
		expect(isAlreadyRequeued(other)).toBe(false)
	})

	it("links the user only to the failed write of a user", () => {
		expect(writeActorOf(FAILED_WRITE)).toBe(USER_ID)
		const codeLists = {
			...FAILED_WRITE,
			clinical_record_write: {
				task_id: TASK_ID,
				object_kind: CLINICAL_RECORD_WRITE_OBJECT_KIND.CODE_LIST_SET,
				object_id: USER_ID,
			},
		}
		expect(writeActorOf(codeLists)).toBeUndefined()
	})

	it("CAP-028-R15 names every kind of alert the contract knows", () => {
		for (const kind of Object.values(ADMINISTRATOR_ALERT_KIND)) {
			expect(alertKindText(kind).trim()).not.toBe("")
		}
	})

	it("CAP-026-R14 links the set-aside objects only from an active alert about them", () => {
		const orphans: AdministratorAlert = {
			...STORED_WITH_WARNING,
			kind: ADMINISTRATOR_ALERT_KIND.ORPHANED_OBJECTS_SET_ASIDE,
			delivery_id: null,
			instance_id: null,
			set_aside_object_count: 2,
		}

		expect(isOrphanedObjectsAlert(orphans)).toBe(true)
		expect(isOrphanedObjectsAlert({ ...orphans, is_active: false })).toBe(false)
		expect(isOrphanedObjectsAlert(STORED_WITH_WARNING)).toBe(false)
	})

	it("CAP-025-R21 names the first broken record only for a broken audit chain", () => {
		const auditRecordId = "44444444-4444-4444-8444-444444444444"
		const brokenChain: AdministratorAlert = {
			...FAILED_WRITE,
			kind: ADMINISTRATOR_ALERT_KIND.AUDIT_CHAIN_BROKEN,
			audit_record_id: auditRecordId,
			clinical_record_write: null,
		}

		expect(brokenAuditRecordOf(brokenChain)).toBe(auditRecordId)
		expect(brokenAuditRecordOf({ ...FAILED_WRITE, audit_record_id: auditRecordId })).toBeUndefined()
	})

	it("shows active alerts unless the address asks for all", () => {
		expect(alertViewOf(null)).toBe(ALERT_VIEW.ACTIVE)
		expect(alertViewOf("all")).toBe(ALERT_VIEW.ALL)
		expect(alertViewOf("anything")).toBe(ALERT_VIEW.ACTIVE)
	})
})
