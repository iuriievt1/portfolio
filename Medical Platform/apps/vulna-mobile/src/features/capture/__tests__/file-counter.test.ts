import { describe, expect, it } from "vitest"
import cs from "../../../i18n/cs.json"
import en from "../../../i18n/en.json"
import type { Texts } from "../../../i18n/texts"
import { fileCounterLabelOf, fileCounterOf } from "../file-counter"

const PHOTO_LIMIT = 5
const PAGE_LIMIT = 20

describe("file counter on the camera and the scanner", () => {
	it("CAP-015-R13 CAP-018-R12 counts the files of the record against the limit", () => {
		expect(fileCounterOf(3, PHOTO_LIMIT, cs)).toBe("3/5")
		expect(fileCounterOf(0, PAGE_LIMIT, cs)).toBe("0/20")
	})

	it("CAP-015-R28 says the count in words for a screen reader in the language of the app", () => {
		expect(fileCounterLabelOf(cs.capture.counter, 3, PHOTO_LIMIT, cs)).toBe("Pořízeno snímků: 3 z 5")
		expect(fileCounterLabelOf(cs.capture.counter, 2, 4, cs)).toBe("Pořízeno snímků: 2 ze 4")
		expect(fileCounterLabelOf(cs.scan.counter, 3, PAGE_LIMIT, cs)).toBe("Naskenováno stránek: 3 ze 20")
		expect(fileCounterLabelOf(en.capture.counter, 3, PHOTO_LIMIT, en as Texts)).toBe("Photos taken: 3 of 5")
	})
})
