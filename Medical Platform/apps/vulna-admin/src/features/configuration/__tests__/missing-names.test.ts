import { ADMINISTRATION_ERROR_CODE } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { AdministrationApiError } from "@/api/client"
import cs from "@/i18n/cs.json"
import { fillText } from "@/lib/format"
import { missingNamesMessage } from "../lib/missing-names"

const UNPROCESSABLE = 422

const ITEM = { kind: "code_list_item", code_list_code: "wound-type", code: "burn", language: "de" }
const REGION = { kind: "body_diagram_region", code_list_code: null, code: "left-heel", language: "de" }

function namesMissing(missingNames: unknown[]): AdministrationApiError {
	return new AdministrationApiError(UNPROCESSABLE, ADMINISTRATION_ERROR_CODE.DEFAULT_LANGUAGE_NAMES_MISSING, {
		code: ADMINISTRATION_ERROR_CODE.DEFAULT_LANGUAGE_NAMES_MISSING,
		missing_names: missingNames,
	})
}

describe("default language without names CAP-012-S19", () => {
	it("lists the code list items and advises to fill them in", () => {
		expect(missingNamesMessage(namesMissing([ITEM]))).toBe(
			fillText(cs.errors.defaultLanguageItemsMissing, { language: "de", names: "wound-type/burn" }),
		)
	})

	it("says the body diagram regions come with a server release", () => {
		expect(missingNamesMessage(namesMissing([REGION]))).toBe(
			[
				cs.errors.defaultLanguageNamesMissing,
				fillText(cs.errors.defaultLanguageRegionsMissing, { language: "de", names: "left-heel" }),
			].join(" "),
		)
	})

	it("names items and regions each in their own sentence", () => {
		expect(missingNamesMessage(namesMissing([ITEM, REGION]))).toBe(
			[
				fillText(cs.errors.defaultLanguageItemsMissing, { language: "de", names: "wound-type/burn" }),
				fillText(cs.errors.defaultLanguageRegionsMissing, { language: "de", names: "left-heel" }),
			].join(" "),
		)
	})

	it("leaves the message to the error code when the list is missing", () => {
		expect(missingNamesMessage(namesMissing([]))).toBeUndefined()
	})

	it("ignores names that come with another error code", () => {
		const other = new AdministrationApiError(UNPROCESSABLE, ADMINISTRATION_ERROR_CODE.VALUE_OUT_OF_RANGE, {
			missing_names: [ITEM],
		})

		expect(missingNamesMessage(other)).toBeUndefined()
	})
})
