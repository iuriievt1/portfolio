import { ERROR_CODE } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { ApiProblemError, NoConnectionError } from "../../../api/api-error"
import { CLINICAL_SECTION, readClinicalSection, shownItemsOf } from "../clinical-section"

const HTTP_UNAVAILABLE = 503
const HTTP_SERVER_ERROR = 500
const ITEMS = ["first", "second"]

describe("overview section read from the clinical record store", () => {
	it("shows the items it read", async () => {
		const section = await readClinicalSection(async () => ITEMS)

		expect(section).toEqual({ kind: CLINICAL_SECTION.SHOWN, items: ITEMS })
		expect(shownItemsOf(section)).toEqual(ITEMS)
	})

	it("CAP-020-R16 E129 keeps an unavailable clinical record store to the section itself", async () => {
		const unavailable = new ApiProblemError(HTTP_UNAVAILABLE, ERROR_CODE.DOCUMENTATION_UNAVAILABLE)

		const section = await readClinicalSection(async () => {
			throw unavailable
		})

		expect(section).toEqual({ kind: CLINICAL_SECTION.UNAVAILABLE })
		expect(shownItemsOf(section)).toEqual([])
	})

	it("CAP-002-R17 lets any other failure fail the whole overview", async () => {
		const offline = new NoConnectionError(new TypeError("Network request failed"))
		const serverError = new ApiProblemError(HTTP_SERVER_ERROR, undefined)

		for (const failure of [offline, serverError]) {
			await expect(
				readClinicalSection(async () => {
					throw failure
				}),
			).rejects.toBe(failure)
		}
		expect(shownItemsOf(undefined)).toEqual([])
	})
})
