import { describe, expect, it } from "vitest"
import { RECORD_NOTE, recordNoteOf } from "../record-note"

const RECORD = "0b6c1d52-6f0e-4a8e-9a43-0d6a0f1f6d10"
const NONE: ReadonlySet<string> = new Set()
const THIS_RECORD: ReadonlySet<string> = new Set([RECORD])

describe("note on the row of an own record", () => {
	it("CAP-015-R36 asks to take again a file the server rejected", () => {
		expect(recordNoteOf({ acquisition_id: RECORD, rejected_file_count: 1 }, { closings: NONE, retakes: NONE })).toBe(
			RECORD_NOTE.RETAKE,
		)
	})

	it("CAP-009-S05 Q-076 asks to take again a file this device cannot read, even before the server knows it", () => {
		expect(
			recordNoteOf({ acquisition_id: RECORD, rejected_file_count: 0 }, { closings: THIS_RECORD, retakes: THIS_RECORD }),
		).toBe(RECORD_NOTE.RETAKE)
	})

	it("CAP-019-R29 E93 says a confirmed record closes after the upload", () => {
		expect(recordNoteOf({ acquisition_id: RECORD }, { closings: THIS_RECORD, retakes: NONE })).toBe(
			RECORD_NOTE.CLOSING_QUEUED,
		)
	})

	it("adds nothing to a record without a queued closure or a file to take again", () => {
		expect(recordNoteOf({ acquisition_id: RECORD, rejected_file_count: 0 }, { closings: NONE, retakes: NONE })).toBe(
			RECORD_NOTE.NONE,
		)
	})
})
