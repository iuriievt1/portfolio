import { ERROR_CODE } from "@ansora/contracts"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { AcquisitionDraft, AcquisitionDraftUpdate } from "../../../api/acquisitions"
import { ApiProblemError } from "../../../api/api-error"
import { CONFLICT_RETRY_ATTEMPTS } from "../conflict-retry"
import { saveDraftStep } from "../draft-update"

const CONFLICT_STATUS = 409
const KNOWN_VERSION = 3
const UPLOADED_AT_MILLISECONDS = Date.UTC(2026, 10, 18, 11, 28)
const MILLISECONDS_PER_SECOND = 1000

const api = vi.hoisted(() => ({
	updateAcquisitionDraft: vi.fn(),
	getAcquisitionDraft: vi.fn(),
}))

vi.mock("../../../api/acquisitions", () => ({ acquisitionApi: api }))
vi.mock("../../session/session-actions", () => ({
	sessionCaller: { call: (work: (sessionToken: string) => Promise<unknown>) => work("session-token") },
}))
vi.mock("../../upload/closure-queue", () => ({ cancelQueuedClosure: async () => undefined }))
vi.mock("../../../utils/random-uuid", () => ({ randomUuid: async () => "request-key" }))

const TITLE_CHANGE = { document_title: { code: "discharge-report" } } as unknown as AcquisitionDraftUpdate

const KNOWN = {
	acquisition_id: "0fbb149c-f635-4ad2-8f3f-65c8995b33b2",
	kind: "scan",
	version: KNOWN_VERSION,
	updated_at: "2026-11-18T11:27:57Z",
	files: [{ file_key: "page-1", status: "announced" }],
} as unknown as AcquisitionDraft

function afterOwnUploads(uploads: number): AcquisitionDraft {
	return {
		...KNOWN,
		version: KNOWN_VERSION + uploads,
		updated_at: new Date(UPLOADED_AT_MILLISECONDS + uploads * MILLISECONDS_PER_SECOND).toISOString(),
		files: [{ file_key: "page-1", status: "received" }],
	} as unknown as AcquisitionDraft
}

const conflict = () => new ApiProblemError(CONFLICT_STATUS, ERROR_CODE.ACQUISITION_VERSION_CONFLICT)
const setTitle = () => TITLE_CHANGE
const sentVersions = () => api.updateAcquisitionDraft.mock.calls.map(([, draft]) => (draft as AcquisitionDraft).version)

beforeEach(() => {
	api.updateAcquisitionDraft.mockReset()
	api.getAcquisitionDraft.mockReset()
})

describe("draft step saved over the record's own uploads", () => {
	it("E115 saves the step after the record's own uploads raised the version twice in a row", async () => {
		api.updateAcquisitionDraft
			.mockRejectedValueOnce(conflict())
			.mockRejectedValueOnce(conflict())
			.mockResolvedValueOnce(afterOwnUploads(3))
		api.getAcquisitionDraft.mockResolvedValueOnce(afterOwnUploads(1)).mockResolvedValueOnce(afterOwnUploads(2))

		await saveDraftStep(KNOWN, setTitle)

		expect(sentVersions()).toEqual([KNOWN_VERSION, KNOWN_VERSION + 1, KNOWN_VERSION + 2])
		expect(api.updateAcquisitionDraft.mock.calls.every(([, , update]) => update === TITLE_CHANGE)).toBe(true)
	})

	it("CAP-021-R32 shows the conflict when the record changed elsewhere between two attempts", async () => {
		const titledElsewhere = {
			...afterOwnUploads(2),
			document_title: { text: "Propouštěcí zpráva" },
		} as unknown as AcquisitionDraft
		api.updateAcquisitionDraft.mockRejectedValue(conflict())
		api.getAcquisitionDraft.mockResolvedValueOnce(afterOwnUploads(1)).mockResolvedValueOnce(titledElsewhere)

		await expect(saveDraftStep(KNOWN, setTitle)).rejects.toMatchObject({
			code: ERROR_CODE.ACQUISITION_VERSION_CONFLICT,
		})
		expect(sentVersions()).toEqual([KNOWN_VERSION, KNOWN_VERSION + 1])
		expect(api.getAcquisitionDraft).toHaveBeenCalledTimes(2)
	})

	it("E115 shows the conflict once the version keeps moving through every attempt", async () => {
		api.updateAcquisitionDraft.mockRejectedValue(conflict())
		api.getAcquisitionDraft.mockImplementation(async () => afterOwnUploads(api.getAcquisitionDraft.mock.calls.length))

		await expect(saveDraftStep(KNOWN, setTitle)).rejects.toMatchObject({
			code: ERROR_CODE.ACQUISITION_VERSION_CONFLICT,
		})
		expect(api.updateAcquisitionDraft).toHaveBeenCalledTimes(CONFLICT_RETRY_ATTEMPTS)
	})

	it("CAP-021-R32 sends nothing more once the fresh record needs no change", async () => {
		const titleOnce = (draft: AcquisitionDraft) => (draft.version === KNOWN_VERSION ? TITLE_CHANGE : undefined)
		api.updateAcquisitionDraft.mockRejectedValueOnce(conflict())
		api.getAcquisitionDraft.mockResolvedValueOnce(afterOwnUploads(1))

		await saveDraftStep(KNOWN, titleOnce)

		expect(api.updateAcquisitionDraft).toHaveBeenCalledTimes(1)
		expect(api.getAcquisitionDraft).toHaveBeenCalledTimes(1)
	})
})
