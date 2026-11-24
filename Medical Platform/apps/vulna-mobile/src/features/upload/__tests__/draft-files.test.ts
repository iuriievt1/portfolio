import { describe, expect, it } from "vitest"
import type { AcquisitionDraft } from "../../../api/acquisitions"
import { isChangedOnlyByUploads, isOrderKept, keysInSequence } from "../draft-files"

type DraftFile = AcquisitionDraft["files"][number]

function file(fileKey: string, sequence: number, status: DraftFile["status"] = "received"): DraftFile {
	return { file_key: fileKey, sequence, status }
}

function draft(files: DraftFile[], change: Partial<AcquisitionDraft> = {}): AcquisitionDraft {
	return {
		acquisition_id: "0b6c1d52-6f0e-4a8e-9a43-0d6a0f1f6d10",
		idempotency_key: "5f3a9e1c-2b7d-4c55-8e0a-7d1b2c3e4f50",
		state: "draft",
		kind: "scan",
		patient: { patient_id: "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a" } as AcquisitionDraft["patient"],
		operator_user_id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
		started_at: "2026-10-08T09:00:00Z",
		updated_at: "2026-10-08T09:05:00Z",
		version: 3,
		files,
		...change,
	}
}

describe("keysInSequence", () => {
	it("CAP-015-R35 lists the files in the order the server leads", () => {
		expect(keysInSequence([file("b", 2), file("c", 3), file("a", 1)])).toEqual(["a", "b", "c"])
	})
})

describe("isOrderKept", () => {
	it("CAP-018-S10 notices pages moved on another device", () => {
		const known = draft([file("a", 1), file("b", 2)])

		expect(isOrderKept(known, draft([file("a", 2), file("b", 1)]))).toBe(false)
		expect(isOrderKept(known, draft([file("a", 1), file("x", 2), file("b", 3)]))).toBe(true)
	})
})

describe("isChangedOnlyByUploads", () => {
	const known = draft([file("a", 1), file("b", 2, "announced")])

	it("CAP-015-R35 CAP-021-R32 takes a newer version from own uploads as no change", () => {
		const uploaded = draft([file("a", 1), file("b", 2), file("c", 3, "announced")], { version: 7 })

		expect(isChangedOnlyByUploads(known, uploaded, ["a", "b", "c"])).toBe(true)
	})

	it("CAP-021-R32 E115 does not cover a change made on another device", () => {
		const moved = draft([file("a", 2), file("b", 1)], { version: 7 })
		const removed = draft([file("a", 1)], { version: 7 })
		const added = draft([file("a", 1), file("b", 2), file("x", 3)], { version: 7 })
		const described = draft(known.files, { version: 7, document_title: { code: "medical-report" } })

		expect(isChangedOnlyByUploads(known, moved, ["a", "b"])).toBe(false)
		expect(isChangedOnlyByUploads(known, removed, ["a", "b"])).toBe(false)
		expect(isChangedOnlyByUploads(known, added, ["a", "b"])).toBe(false)
		expect(isChangedOnlyByUploads(known, described, ["a", "b"])).toBe(false)
	})
})
