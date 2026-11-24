import { describe, expect, it } from "vitest"
import { filesByRecord, isImageDataAvailable } from "../utils/record-files"
import { ACQUISITION, recordFile } from "./image-fixtures"

const OTHER_ACQUISITION = "a0000000-0000-4000-8000-000000000011"

describe("files of closed records CAP-020-R17", () => {
	it("keeps the order of the files within each record", () => {
		const first = recordFile({ id: "c0000000-0000-4000-8000-000000000001", sequence: 1 })
		const second = recordFile({ id: "c0000000-0000-4000-8000-000000000002", sequence: 2 })
		const other = recordFile({ id: "c0000000-0000-4000-8000-000000000003", acquisition_id: OTHER_ACQUISITION })

		const byRecord = filesByRecord([first, other, second])

		expect(byRecord.get(ACQUISITION)).toEqual([first, second])
		expect(byRecord.get(OTHER_ACQUISITION)).toEqual([other])
	})

	it("CAP-020-R07 reports image data as available only while every original is held", () => {
		expect(isImageDataAvailable([recordFile(), recordFile()])).toBe(true)
		expect(isImageDataAvailable([recordFile(), recordFile({ is_available: false })])).toBe(false)
		expect(isImageDataAvailable([])).toBe(false)
	})
})
