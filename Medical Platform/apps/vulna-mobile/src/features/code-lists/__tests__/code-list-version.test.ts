import { describe, expect, it } from "vitest"
import type { CodeListSet } from "../../../api/code-lists"
import { codeListsAfter } from "../code-list-version"

function codeLists(version: string, woundTypeCodes: readonly string[]): CodeListSet {
	return {
		version,
		wound_types: woundTypeCodes.map((code) => ({ code, text: code, names: { cs: code }, is_selectable: true })),
		healing_phases: [],
		document_titles: [],
		body_diagram: { version: "1", regions: [] },
	}
}

const KNOWN = codeLists("7", ["leg-ulcer"])

describe("code lists after a sync ADR-023", () => {
	it("CAP-017-R18 takes the first set the server sends", () => {
		const received = codeLists("7", ["leg-ulcer"])

		expect(codeListsAfter(undefined, received)).toBe(received)
	})

	it("CAP-017-R18 keeps the known set when the server answers the same version without lists", () => {
		expect(codeListsAfter(KNOWN, codeLists("7", []))).toBe(KNOWN)
	})

	it("CAP-017-R18 replaces the known set with a new version", () => {
		const received = codeLists("8", ["pressure-injury"])

		expect(codeListsAfter(KNOWN, received)).toBe(received)
	})
})
