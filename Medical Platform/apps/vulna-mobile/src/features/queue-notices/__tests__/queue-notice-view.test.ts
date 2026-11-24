import { ERROR_CODE } from "@ansora/contracts"
import type { QueueNotice } from "@ansora/core-mobile"
import { describe, expect, it, vi } from "vitest"
import type { AcquisitionDraftSummary } from "../../../api/acquisitions"
import cs from "../../../i18n/cs.json"
import { layeredTexts } from "../../../i18n/texts"
import { isQueueLossOf, NOTICE_ACTION, queueNoticeViewOf } from "../queue-notice-view"

vi.mock("@ansora/core-mobile", async () => ({
	...(await import("../../../../../../libs/core/mobile/src/storage/upload-status")),
	...(await import("../../../../../../libs/core/mobile/src/storage/queue-notice")),
}))

function notice(change: Partial<QueueNotice> = {}): QueueNotice {
	return {
		id: "file:a",
		kind: "file_rejected",
		operatorUserId: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
		acquisitionId: "0b6c1d52-6f0e-4a8e-9a43-0d6a0f1f6d10",
		recordKind: "photo",
		capturedAt: "2026-10-19T06:58:00.000Z",
		rejectionCode: ERROR_CODE.RECORD_REJECTED,
		createdAt: "2026-10-19T07:10:00.000Z",
		...change,
	}
}

describe("queue notices E55", () => {
	it("CAP-019-S10 E55 asks to take the refused photo again in the same record", () => {
		expect(queueNoticeViewOf(notice(), cs)).toEqual({
			title: "Server odmítl váš snímek",
			body: "Snímek z 19. 10. 2026 8:58 server nepřijal. Záznam zůstává rozpracovaný: pořiďte snímek znovu v tomto záznamu.",
			action: NOTICE_ACTION.OPEN_RECORD,
		})
		expect(queueNoticeViewOf(notice({ recordKind: "scan" }), cs).title).toBe("Server odmítl vaši stránku")
	})

	it("CAP-019-S18 E113 says the file was not used and does not ask to take it again", () => {
		const view = queueNoticeViewOf(notice({ rejectionCode: ERROR_CODE.ACQUISITION_ALREADY_DECIDED }), cs)

		expect(view.title).toBe("Snímek se nepoužil")
		expect(view.action).toBe(NOTICE_ACTION.NONE)
	})

	it("CAP-019-S03 E27 tells that a file of a record the server does not know is lost for the PACS", () => {
		const view = queueNoticeViewOf(notice({ rejectionCode: ERROR_CODE.RESOURCE_NOT_FOUND }), cs)

		expect(view.title).toBe("Server snímek trvale odmítl")
		expect(view.action).toBe(NOTICE_ACTION.NONE)
	})

	it("CAP-019-R18 says that sending slowed down without asking for anything", () => {
		expect(queueNoticeViewOf(notice({ kind: "file_slowed", rejectionCode: null }), cs)).toEqual({
			title: "Snímek se zatím neodeslal",
			body: "Váš snímek z 19. 10. 2026 8:58 se zatím nepodařilo odeslat. Zkoušíme to dál, jen méně často.",
			action: NOTICE_ACTION.NONE,
		})
	})

	it("CAP-019-R29 E114 offers the summary of a record the queue did not close", () => {
		const closure = { id: "closure:0b6c1d52", capturedAt: null, rejectionCode: null }

		expect(queueNoticeViewOf(notice({ ...closure, kind: "closure_changed" }), cs)).toEqual({
			title: "Záznam jsme neuzavřeli",
			body: "Záznam jste mezitím změnili na jiném zařízení. Zkontrolujte souhrn a potvrďte ho znovu.",
			action: NOTICE_ACTION.OPEN_SUMMARY,
		})
		expect(queueNoticeViewOf(notice({ ...closure, kind: "closure_file_rejected", recordKind: "scan" }), cs).body).toBe(
			"Jednu stránku server nepřijal — pořiďte ji znovu. Zkontrolujte souhrn a potvrďte ho znovu.",
		)
		expect(queueNoticeViewOf(notice({ ...closure, kind: "closure_refused" }), cs).body).toBe(
			"Server záznam neuzavřel. Zkontrolujte souhrn a potvrďte ho znovu.",
		)
	})

	it("CAP-009-S05 Q-076 asks to take a photo the device cannot read again in the same record", () => {
		expect(queueNoticeViewOf(notice({ kind: "file_unreadable", rejectionCode: null }), cs)).toEqual({
			title: "Snímek nejde přečíst",
			body: "Snímek z 19. 10. 2026 8:58 nejde na tomto zařízení přečíst, a proto se neodešle. Pořiďte ho v tomto záznamu znovu.",
			action: NOTICE_ACTION.OPEN_RECORD,
		})
	})

	it("CAP-009-S05 CAP-019-R29 Q-076 offers the summary of a record the queue did not close for an unreadable page", () => {
		const closure = { id: "closure:0b6c1d52", capturedAt: null, rejectionCode: null }

		expect(queueNoticeViewOf(notice({ ...closure, kind: "closure_file_unreadable", recordKind: "scan" }), cs)).toEqual({
			title: "Záznam jsme neuzavřeli",
			body: "Jednu stránku nejde na tomto zařízení přečíst — pořiďte ji znovu. Zkontrolujte souhrn a potvrďte ho znovu.",
			action: NOTICE_ACTION.OPEN_SUMMARY,
		})
	})

	it("CAP-009-S05 Q-076 tells about the lost queue only a user whose record was started before the loss", () => {
		const startedAt = (started_at: string) => ({ started_at }) as AcquisitionDraftSummary
		const lostAt = "2026-10-19T08:00:00.000Z"

		expect(isQueueLossOf(lostAt, [startedAt("2026-10-19T07:30:00.000Z")])).toBe(true)
		expect(isQueueLossOf(lostAt, [startedAt("2026-10-19T08:30:00.000Z")])).toBe(false)
		expect(isQueueLossOf(undefined, [startedAt("2026-10-19T07:30:00.000Z")])).toBe(false)
	})

	it("CAP-015-R23 gives the notice in another language without code", () => {
		expect(queueNoticeViewOf(notice(), layeredTexts("cs", ["en"])).title).toBe("The server rejected your photo")
	})
})
