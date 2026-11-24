import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { pointsOf, winAnsiOf } from "../pdf-canvas"
import { printSheetPdf, woundsJson } from "../print-sheet"
import { PRINT_SHEET_FILE, WOUNDS_DIRECTORY, WOUNDS_FILE } from "../set-paths"
import { IRREGULAR_OUTLINE, PRINTED_WOUNDS, WOUND_SHAPE } from "../wounds"

const A4_MEDIA_BOX = "/MediaBox [0 0 595.276 841.89]"
const POINTS_PER_INCH = 72
const MILLIMETRES_PER_INCH = 25.4

describe("print sheet of the synthetic wounds kvalita-rizika-a-pouzitelnost.md 7", () => {
	it("ADR-024 keeps the committed sheet and the list of wounds exactly as the generator writes them", () => {
		expect(readFileSync(join(WOUNDS_DIRECTORY, PRINT_SHEET_FILE))).toEqual(printSheetPdf())
		expect(readFileSync(join(WOUNDS_DIRECTORY, WOUNDS_FILE), "utf8")).toBe(woundsJson())
	})

	it("ISO 216 draws on an A4 page in true size", () => {
		expect(printSheetPdf().toString("latin1")).toContain(A4_MEDIA_BOX)
		expect(pointsOf(MILLIMETRES_PER_INCH)).toBe(POINTS_PER_INCH)
	})

	it("gives the irregular wound exactly the width and height its label states", () => {
		const irregular = PRINTED_WOUNDS.find((wound) => wound.shape === WOUND_SHAPE.POLYGON)
		const xs = IRREGULAR_OUTLINE.map(([x]) => x)
		const ys = IRREGULAR_OUTLINE.map(([, y]) => y)

		expect(Math.max(...xs) - Math.min(...xs)).toBe(irregular?.widthMillimetres)
		expect(Math.max(...ys) - Math.min(...ys)).toBe(irregular?.heightMillimetres)
	})

	it("ISO 32000-1 D.2 refuses a character the standard font cannot print instead of dropping it", () => {
		const label = "rány · 20 × 12 mm"

		expect(winAnsiOf(label)).toHaveLength(label.length)
		expect(() => winAnsiOf("předloha")).toThrow(/not in WinAnsiEncoding/)
	})
})
