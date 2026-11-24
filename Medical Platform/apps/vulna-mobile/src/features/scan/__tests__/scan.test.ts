import { localizedNameOf } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import type { AcquisitionDraft } from "../../../api/acquisitions"
import type { LocalizedNames } from "../../../api/code-lists"
import cs from "../../../i18n/cs.json"
import { documentTitleTextOf, titleCodeUpdateOf, titleTextUpdateOf } from "../document-title"
import { columnsWithin, gridHeightOf, indexAt, movedKeys, PAGE_TILE_HEIGHT, slotOf } from "../page-grid-layout"
import { pageLabelOf, pageTitleOf } from "../page-text"
import { cornersOf, isConvex, movedCorner, securedPageOf, WHOLE_PAGE } from "../scanned-page"

const nameOf = (names: LocalizedNames) => localizedNameOf(names, "cs", "cs")

const TITLES = [
	{ code: "medical-report", text: "Lékařská zpráva", names: { cs: "Lékařská zpráva" }, is_selectable: true },
]

function scanDraft(change: Partial<AcquisitionDraft> = {}): AcquisitionDraft {
	return {
		acquisition_id: "0b6c1d52-6f0e-4a8e-9a43-0d6a0f1f6d10",
		idempotency_key: "5f3a9e1c-2b7d-4c55-8e0a-7d1b2c3e4f50",
		state: "draft",
		kind: "scan",
		patient: {} as AcquisitionDraft["patient"],
		operator_user_id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
		started_at: "2026-10-08T09:00:00Z",
		updated_at: "2026-10-08T09:05:00Z",
		version: 2,
		files: [],
		...change,
	}
}

describe("document title", () => {
	it("CAP-018-R15 CAP-017-R09 saves the chosen code with the version of the code lists", () => {
		expect(titleCodeUpdateOf(scanDraft(), "medical-report", "7")).toEqual({
			document_title: { code: "medical-report", code_list_version: "7" },
		})
		expect(titleCodeUpdateOf(scanDraft({ document_title: { code: "medical-report" } }), "medical-report", "7")).toBe(
			undefined,
		)
	})

	it("CAP-018-R15 saves a custom title without the blanks around it", () => {
		expect(titleTextUpdateOf(scanDraft(), "  Výpis z karty ")).toEqual({ document_title: { text: "Výpis z karty" } })
		expect(titleTextUpdateOf(scanDraft(), "   ")).toBe(undefined)
	})

	it("CAP-017-R18 shows the chosen title by its name, a custom title as typed", () => {
		expect(documentTitleTextOf({ code: "medical-report" }, TITLES, nameOf)).toBe("Lékařská zpráva")
		expect(documentTitleTextOf({ text: "Výpis z karty" }, TITLES, nameOf)).toBe("Výpis z karty")
		expect(documentTitleTextOf(undefined, TITLES, nameOf)).toBe(undefined)
	})
})

describe("scanned page", () => {
	it("CAP-018-R11 keeps the detected edges of a page for a later crop", () => {
		const corners = {
			topLeft: { x: 0.1, y: 0.1 },
			topRight: { x: 0.9, y: 0.1 },
			bottomRight: { x: 0.9, y: 0.9 },
			bottomLeft: { x: 0.1, y: 0.9 },
		}
		const file = { path: "/vault/queue/page", wrappedKey: "key" }
		const secured = securedPageOf({ page: file, thumbnail: file, original: file, corners, width: 2480, height: 3508 })

		expect(cornersOf(secured)).toEqual(corners)
	})

	it("CAP-018-S02 offers the whole page when no edges were found", () => {
		expect(cornersOf({ corners: null })).toEqual(WHOLE_PAGE)
		expect(cornersOf({ corners: "not json" })).toEqual(WHOLE_PAGE)
	})

	it("CAP-018-R10 keeps a moved corner on the page", () => {
		expect(movedCorner(WHOLE_PAGE, "topLeft", { x: -0.2, y: 0.3 }).topLeft).toEqual({ x: 0, y: 0.3 })
	})
})

describe("manual crop outline", () => {
	const BENT = { ...WHOLE_PAGE, bottomRight: { x: 0.2, y: 0.2 } }

	it("CAP-018-R10 moves a corner while the outline stays convex", () => {
		expect(movedCorner(WHOLE_PAGE, "topLeft", { x: 0.1, y: 0.2 }).topLeft).toEqual({ x: 0.1, y: 0.2 })
	})

	it("CAP-018-R10 stops a corner that would bend the outline inwards", () => {
		expect(movedCorner(WHOLE_PAGE, "bottomRight", { x: 0.2, y: 0.2 })).toEqual(WHOLE_PAGE)
	})

	it("CAP-018-R10 stops a corner that would cross or line up with its neighbours", () => {
		expect(movedCorner(WHOLE_PAGE, "topLeft", { x: 1, y: 0.5 })).toEqual(WHOLE_PAGE)
		expect(movedCorner(WHOLE_PAGE, "topRight", { x: 0, y: 0.5 })).toEqual(WHOLE_PAGE)
	})

	it("CAP-018-R10 lets a bent outline from the scanner be straightened", () => {
		const straightened = movedCorner(BENT, "bottomRight", { x: 0.9, y: 0.9 })

		expect(straightened.bottomRight).toEqual({ x: 0.9, y: 0.9 })
		expect(isConvex(straightened)).toBe(true)
	})

	it("CAP-018-R10 tells a bent or mirrored outline from a convex one", () => {
		expect(isConvex(WHOLE_PAGE)).toBe(true)
		expect(isConvex(BENT)).toBe(false)
		expect(isConvex({ ...WHOLE_PAGE, topLeft: WHOLE_PAGE.topRight, topRight: WHOLE_PAGE.topLeft })).toBe(false)
	})
})

describe("page grid", () => {
	it("Figma 06 A.4 lays four pages in a row on a phone", () => {
		expect(columnsWithin(345)).toBe(4)
		expect(slotOf(5, 4)).toEqual({ x: 88, y: PAGE_TILE_HEIGHT + 40 })
		expect(gridHeightOf(4, 4)).toBe(PAGE_TILE_HEIGHT + 24)
	})

	it("CAP-018-R11 CAP-018-S10 moves a dragged page where it was dropped", () => {
		expect(indexAt({ x: 180, y: 4 }, 4, 3)).toBe(2)
		expect(indexAt({ x: 400, y: 900 }, 4, 3)).toBe(2)
		expect(movedKeys(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"])
	})

	it("CAP-018-S10 moves a page back to the front of the document", () => {
		expect(indexAt({ x: -50, y: -50 }, 4, 3)).toBe(0)
		expect(movedKeys(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"])
	})

	it("Vulna / Media / Grid keeps one column on a narrow screen", () => {
		expect(columnsWithin(0)).toBe(1)
		expect(columnsWithin(50)).toBe(1)
		expect(slotOf(1, 1)).toEqual({ x: 0, y: PAGE_TILE_HEIGHT + 40 })
	})

	it("Figma 06 A.4 grows the grid by a row for the add tile", () => {
		expect(gridHeightOf(0, 4)).toBe(0)
		expect(gridHeightOf(5, 4)).toBe(2 * PAGE_TILE_HEIGHT + 64)
	})
})

describe("page texts", () => {
	it("Figma 06 B.2 names the page and where it is in the document", () => {
		expect(pageTitleOf(1, 3, cs)).toBe("Stránka 2 ze 3")
		expect(pageTitleOf(3, 9, cs)).toBe("Stránka 4 z 9")
		expect(pageLabelOf(0, cs)).toBe("Stránka 1")
	})
})
