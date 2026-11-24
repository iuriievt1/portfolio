import { describe, expect, it } from "vitest"
import type { CodeListSet } from "../../../api/code-lists"
import type { AcquisitionDetail } from "../../../api/record"
import { heldRecordOf, holdRecord, type RecordContent } from "../held-records"

const RECORD = {
	detail: { acquisition_id: "record" } as AcquisitionDetail,
	codeLists: {} as CodeListSet,
} satisfies RecordContent

describe("held records", () => {
	it("CAP-025-R28 lets the viewer reuse the record its detail already opened", () => {
		const release = holdRecord("record", RECORD)
		expect(heldRecordOf("record")).toBe(RECORD)
		release()
	})

	it("CAP-020-R02 forgets the record once the last screen lets it go", () => {
		const releaseDetail = holdRecord("record", RECORD)
		const releaseViewer = holdRecord("record", RECORD)
		releaseViewer()
		expect(heldRecordOf("record")).toBe(RECORD)
		releaseDetail()
		expect(heldRecordOf("record")).toBeUndefined()
	})
})
