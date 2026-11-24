import { describe, expect, it } from "vitest"
import { NO_PROGRESS } from "../constants/encounter.constants"
import { recordProgressOf } from "../utils/record-progress"

const RECORD = "a0000000-0000-4000-8000-000000000001"

describe("progress of a record in a visit CAP-014-R22", () => {
	it("CAP-015-R35 CAP-015-R36 takes the file counts the write path keeps", () => {
		const progress = recordProgressOf(
			{ acquisition_id: RECORD, has_wound_type: true, has_healing_phase: false, has_document_title: false },
			{ acquisition_id: RECORD, held: 4, received: 2, announced: 1, rejected: 1, announced_elsewhere: 1 },
		)

		expect(progress).toEqual({
			has_wound_type: true,
			has_healing_phase: false,
			has_document_title: false,
			received_count: 2,
			announced_count: 1,
			rejected_count: 1,
			files_on_other_device: true,
		})
	})

	it("CAP-015-S51 keeps a record whose files wait on this device off another device", () => {
		const progress = recordProgressOf(undefined, {
			acquisition_id: RECORD,
			held: 1,
			received: 0,
			announced: 1,
			rejected: 0,
			announced_elsewhere: 0,
		})

		expect(progress.files_on_other_device).toBe(false)
	})

	it("CAP-015-R31 treats a record without files and content as empty", () => {
		expect(recordProgressOf(undefined, undefined)).toEqual(NO_PROGRESS)
	})
})
