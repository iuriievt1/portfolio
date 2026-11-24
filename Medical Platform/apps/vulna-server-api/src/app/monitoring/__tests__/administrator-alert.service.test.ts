import {
	ADMINISTRATOR_ALERT_KIND,
	BINARY_RENDITION,
	BINARY_UPLOAD_RECORD_KIND,
	CLINICAL_RECORD_WRITE_OBJECT_KIND,
} from "@ansora/contracts"
import { JOB_OBJECT_KIND } from "@ansora/core-server"
import { describe, expect, it } from "vitest"
import type { ConfigurationService } from "../../configuration/services/configuration.service"
import { administratorAlertPageSchema } from "../dto/administrator-alert-page.input.dto"
import type { AdministratorAlertRepository } from "../repositories/administrator-alert.repository"
import { AdministratorAlertService } from "../services/administrator-alert.service"
import type { AdministratorAlertPage, AdministratorAlertQuery, AdministratorAlertRow } from "../types/monitoring.types"
import { administratorAlertViewOf } from "../utils/administrator-alert-view"

const DELIVERY_ID = "77777777-7777-4777-8777-777777777777"
const ADMINISTRATOR_ID = "88888888-8888-4888-8888-888888888888"
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50
const NEXT_CURSOR = "next"
const MESSAGE = "Úložiště klinického záznamu nepřijalo zápis uživatele. Po odstranění příčiny zápis zopakujte."

const ROW: AdministratorAlertRow = {
	id: "a0000000-0000-4000-8000-000000000001",
	kind: ADMINISTRATOR_ALERT_KIND.CLINICAL_RECORD_WRITE_FAILED,
	raised_at: new Date("2026-10-15T08:00:00Z"),
	resolved_at: null,
	message: MESSAGE,
	audit_id: null,
	delivery_id: null,
	delivery_instance_id: null,
	target_code: null,
	set_aside_object_count: null,
	acknowledged_at: null,
	acknowledged_by_user_id: null,
	cursor_moment: "2026-10-15T08:00:00.000000Z",
	task_id: "33333333-3333-4333-8333-333333333333",
	object_kind: CLINICAL_RECORD_WRITE_OBJECT_KIND.ACTOR,
	object_id: "22222222-2222-4222-8222-222222222222",
	image_acquisition_id: null,
	page_document_id: null,
	pdf_document_id: null,
	pending_rendition: null,
}

const FILE_ID = "55555555-5555-4555-8555-555555555555"
const RECORD_ID = "66666666-6666-4666-8666-666666666666"
const UPLOAD_MESSAGE = "Nahrání snímku do úložiště klinického záznamu selhalo."

function fileAlertRow(overrides: Partial<AdministratorAlertRow>): AdministratorAlertRow {
	return {
		...ROW,
		kind: ADMINISTRATOR_ALERT_KIND.CLINICAL_RECORD_BINARY_UPLOAD_FAILED,
		message: UPLOAD_MESSAGE,
		object_kind: CLINICAL_RECORD_WRITE_OBJECT_KIND.IMAGE,
		object_id: FILE_ID,
		image_acquisition_id: RECORD_ID,
		pending_rendition: BINARY_RENDITION.ORIGINAL,
		...overrides,
	}
}

function harness(page: AdministratorAlertPage) {
	const queries: AdministratorAlertQuery[] = []
	const alerts = {
		page: async (query: AdministratorAlertQuery) => {
			queries.push(query)
			return page
		},
	} as unknown as AdministratorAlertRepository
	const configuration = {
		pageSize: async () => ({ defaultSize: DEFAULT_PAGE_SIZE, maxSize: MAX_PAGE_SIZE }),
	} as unknown as ConfigurationService
	return { service: new AdministratorAlertService(alerts, configuration), queries }
}

describe("administrator alerts administration.yaml listAdministratorAlerts", () => {
	it("CAP-021-S25 hands over the failed write with its task and object, without clinical content", async () => {
		const run = harness({ rows: [ROW], nextCursor: NEXT_CURSOR })

		const page = await run.service.list({ is_active: true })

		expect(page).toEqual({
			items: [
				{
					id: ROW.id,
					kind: ADMINISTRATOR_ALERT_KIND.CLINICAL_RECORD_WRITE_FAILED,
					raised_at: "2026-10-15T08:00:00.000Z",
					is_active: true,
					message: MESSAGE,
					audit_record_id: null,
					delivery_id: null,
					instance_id: null,
					target_code: null,
					set_aside_object_count: null,
					clinical_record_write: {
						task_id: ROW.task_id,
						object_kind: CLINICAL_RECORD_WRITE_OBJECT_KIND.ACTOR,
						object_id: ROW.object_id,
					},
					clinical_record_binary_upload: null,
					acknowledgement: null,
				},
			],
			next_cursor: NEXT_CURSOR,
		})
		expect(run.queries).toEqual([{ limit: DEFAULT_PAGE_SIZE, cursor: undefined, kind: undefined, isActive: true }])
	})

	it("CAP-021-R27 marks the alert inactive once the cause has passed", () => {
		const view = administratorAlertViewOf({ ...ROW, resolved_at: new Date("2026-10-15T09:00:00Z") })

		expect(view.is_active).toBe(false)
	})

	it("CAP-023-R12 hands over who acknowledged a warning and when", () => {
		const acknowledgedAt = new Date("2026-11-09T10:15:00Z")
		const view = administratorAlertViewOf({
			...ROW,
			kind: ADMINISTRATOR_ALERT_KIND.STORED_WITH_WARNING,
			resolved_at: acknowledgedAt,
			acknowledged_at: acknowledgedAt,
			acknowledged_by_user_id: ADMINISTRATOR_ID,
		})

		expect(view.is_active).toBe(false)
		expect(view.acknowledgement).toEqual({
			acknowledged_at: acknowledgedAt.toISOString(),
			acknowledged_by_user_id: ADMINISTRATOR_ID,
		})
	})

	it("keeps the page within the configured maximum", async () => {
		const run = harness({ rows: [], nextCursor: null })

		await run.service.list({ limit: MAX_PAGE_SIZE + 1, cursor: "cursor" })

		expect(run.queries[0]).toMatchObject({ limit: MAX_PAGE_SIZE, cursor: "cursor" })
	})
})

// administration.yaml AdministratorAlert.clinical_record_binary_upload
describe("alerts about the bytes of a closed record CAP-021-R36, CAP-021-R40", () => {
	it("CAP-021-S27 hands over the failed upload of a photo with its task, record, file and the bytes that failed", () => {
		const view = administratorAlertViewOf(fileAlertRow({ pending_rendition: BINARY_RENDITION.THUMBNAIL }))

		expect(view.clinical_record_binary_upload).toEqual({
			task_id: ROW.task_id,
			record_kind: BINARY_UPLOAD_RECORD_KIND.ACQUISITION,
			record_id: RECORD_ID,
			file_id: FILE_ID,
			rendition: BINARY_RENDITION.THUMBNAIL,
		})
		expect(view.clinical_record_write).toBeNull()
	})

	it("CAP-021-R36 names no rendition once every byte of the file is confirmed", () => {
		const view = administratorAlertViewOf(
			fileAlertRow({ resolved_at: new Date("2026-10-15T09:00:00Z"), pending_rendition: null }),
		)

		expect(view.clinical_record_binary_upload).not.toHaveProperty("rendition")
	})

	it("CAP-021-R36 names the scanned document as the record of a failed page upload", () => {
		const view = administratorAlertViewOf(
			fileAlertRow({
				object_kind: CLINICAL_RECORD_WRITE_OBJECT_KIND.DOCUMENT_PAGE,
				image_acquisition_id: null,
				page_document_id: RECORD_ID,
			}),
		)

		expect(view.clinical_record_binary_upload).toMatchObject({
			record_kind: BINARY_UPLOAD_RECORD_KIND.DOCUMENT,
			record_id: RECORD_ID,
		})
	})

	it("CAP-021-R39 names the scanned document and its PDF in a failed upload of the PDF", () => {
		const view = administratorAlertViewOf(
			fileAlertRow({
				object_kind: CLINICAL_RECORD_WRITE_OBJECT_KIND.DOCUMENT,
				object_id: RECORD_ID,
				image_acquisition_id: null,
				pdf_document_id: RECORD_ID,
				pending_rendition: BINARY_RENDITION.OUTPUT_PDF,
			}),
		)

		expect(view.clinical_record_binary_upload).toEqual({
			task_id: ROW.task_id,
			record_kind: BINARY_UPLOAD_RECORD_KIND.DOCUMENT,
			record_id: RECORD_ID,
			file_id: RECORD_ID,
			rendition: BINARY_RENDITION.OUTPUT_PDF,
		})
	})

	it("CAP-021-R40 names the missing viewing copy without a task to requeue", () => {
		const view = administratorAlertViewOf(
			fileAlertRow({ kind: ADMINISTRATOR_ALERT_KIND.VIEWING_COPY_GENERATION_FAILED }),
		)

		expect(view.clinical_record_binary_upload).toEqual({
			task_id: null,
			record_kind: BINARY_UPLOAD_RECORD_KIND.ACQUISITION,
			record_id: RECORD_ID,
			file_id: FILE_ID,
			rendition: BINARY_RENDITION.VIEWING_COPY,
		})
		expect(view.clinical_record_write).toBeNull()
	})

	it("CAP-021-R37 hands over the failed write of an image source as a write, not as an upload", () => {
		const view = administratorAlertViewOf(fileAlertRow({ kind: ADMINISTRATOR_ALERT_KIND.CLINICAL_RECORD_WRITE_FAILED }))

		expect(view.clinical_record_write).toEqual({
			task_id: ROW.task_id,
			object_kind: CLINICAL_RECORD_WRITE_OBJECT_KIND.IMAGE,
			object_id: FILE_ID,
		})
		expect(view.clinical_record_binary_upload).toBeNull()
	})

	it("CAP-025-R21 hands over the first broken audit record of a broken chain", () => {
		const auditId = "44444444-4444-4444-8444-444444444444"
		const view = administratorAlertViewOf({
			...ROW,
			kind: ADMINISTRATOR_ALERT_KIND.AUDIT_CHAIN_BROKEN,
			audit_id: auditId,
			task_id: null,
			object_kind: null,
			object_id: null,
		})

		expect(view.audit_record_id).toBe(auditId)
		expect(view.clinical_record_write).toBeNull()
		expect(view.clinical_record_binary_upload).toBeNull()
	})

	it("CAP-022-R11 hands over the delivery whose assembly failed for good, and no write or upload", () => {
		const view = administratorAlertViewOf({
			...ROW,
			kind: ADMINISTRATOR_ALERT_KIND.ASSEMBLY_FAILED,
			delivery_id: DELIVERY_ID,
			object_kind: JOB_OBJECT_KIND.ACQUISITION,
			object_id: RECORD_ID,
		})

		expect(view.delivery_id).toBe(DELIVERY_ID)
		expect(view.clinical_record_write).toBeNull()
		expect(view.clinical_record_binary_upload).toBeNull()
	})
})

describe("alerts about the delivery to the PACS CAP-023-R17, CAP-023-R26, CAP-023-R27", () => {
	it("CAP-023-S18 names the delivery and the instance whose verification waits for the administrator", () => {
		const view = administratorAlertViewOf({
			...ROW,
			kind: ADMINISTRATOR_ALERT_KIND.VERIFICATION_REJECTED,
			delivery_id: DELIVERY_ID,
			delivery_instance_id: FILE_ID,
			task_id: null,
			object_kind: null,
			object_id: null,
		})

		expect(view).toMatchObject({ delivery_id: DELIVERY_ID, instance_id: FILE_ID, target_code: null })
		expect(view.clinical_record_write).toBeNull()
	})

	it("CAP-023-S22 names the target that has been unavailable too long", () => {
		const view = administratorAlertViewOf({
			...ROW,
			kind: ADMINISTRATOR_ALERT_KIND.TARGET_UNAVAILABILITY,
			target_code: "pacs",
			task_id: null,
			object_kind: null,
			object_id: null,
		})

		expect(view).toMatchObject({ delivery_id: null, instance_id: null, target_code: "pacs" })
	})

	it("CAP-021-R28 hands over a failed write of the delivered instances with its record", () => {
		const view = administratorAlertViewOf({
			...ROW,
			object_kind: CLINICAL_RECORD_WRITE_OBJECT_KIND.ACQUISITION,
			object_id: RECORD_ID,
		})

		expect(view.clinical_record_write).toEqual({
			task_id: ROW.task_id,
			object_kind: CLINICAL_RECORD_WRITE_OBJECT_KIND.ACQUISITION,
			object_id: RECORD_ID,
		})
	})
})

describe("alert filters administration.yaml listAdministratorAlerts", () => {
	it("reads is_active only as true or false", () => {
		expect(administratorAlertPageSchema.parse({ is_active: "true" }).is_active).toBe(true)
		expect(administratorAlertPageSchema.parse({ is_active: "false" }).is_active).toBe(false)
		expect(administratorAlertPageSchema.safeParse({ is_active: "1" }).success).toBe(false)
		expect(administratorAlertPageSchema.safeParse({ is_active: "yes" }).success).toBe(false)
	})

	it("accepts every kind of the contract and nothing else", () => {
		for (const kind of Object.values(ADMINISTRATOR_ALERT_KIND)) {
			expect(administratorAlertPageSchema.safeParse({ kind }).success).toBe(true)
		}
		expect(administratorAlertPageSchema.safeParse({ kind: "unknown_kind" }).success).toBe(false)
	})
})

describe("alerts about orphaned objects CAP-026-R14", () => {
	it("CAP-026-R14 says how many orphaned objects the run of the cleanup set aside", () => {
		const view = administratorAlertViewOf({
			...ROW,
			kind: ADMINISTRATOR_ALERT_KIND.ORPHANED_OBJECTS_SET_ASIDE,
			set_aside_object_count: 3,
			task_id: null,
			object_kind: null,
			object_id: null,
		})

		expect(view).toMatchObject({ set_aside_object_count: 3, clinical_record_write: null })
	})
})
