import { describe, expect, it } from "vitest"
import type { BodySite, Finding } from "../../../api/findings"
import cs from "../../../i18n/cs.json"
import { formatDate } from "../../../utils/format-date"
import { WOUND_CHOICE } from "../../capture/capture-session"
import { chosenWoundTitleOf } from "../chosen-wound"

const SITE: BodySite = {
	region_code: "51027004",
	laterality: null,
	view: "posterior",
	x: 0.5,
	y: 0.46,
	body_diagram_version: "1",
}
const CREATED_AT = "2026-09-01T08:00:00Z"
const TAKEN_AT = "2026-09-12T08:00:00Z"

function finding(id: string, number: number, lastAcquisition: string | undefined): Finding {
	return {
		finding_id: id,
		patient_id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
		number,
		created_at: CREATED_AT,
		last_body_site: SITE,
		last_acquisition: lastAcquisition,
	}
}

describe("title of the chosen wound", () => {
	it("CAP-016-R17 names a new wound", () => {
		expect(chosenWoundTitleOf({ kind: WOUND_CHOICE.NEW, bodySite: SITE, findingKey: undefined }, cs)).toBe("Nová rána")
	})

	it("E106, CAP-020-R23 names a tracked wound by the number the server gave it", () => {
		const tracked = finding("a", 2, undefined)

		expect(chosenWoundTitleOf({ kind: WOUND_CHOICE.EXISTING, finding: tracked, bodySite: SITE }, cs)).toBe("Rána 2")
	})

	it("Figma 05 B.3 adds when the wound was photographed last", () => {
		const tracked = finding("b", 5, TAKEN_AT)
		const date = formatDate(new Date(TAKEN_AT), cs.language)

		expect(chosenWoundTitleOf({ kind: WOUND_CHOICE.EXISTING, finding: tracked, bodySite: SITE }, cs)).toBe(
			`Rána 5 · naposledy vyfocena ${date}`,
		)
	})
})
