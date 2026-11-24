import type { ClinicalCodeListSet } from "@ansora/vulna-domain/ports"
import { describe, expect, it } from "vitest"
import { activeValueSetOf, codeListUrlsOf, codeSystemOf, wholeValueSetOf } from "../code-list-resources"
import { DEFAULT_CANONICAL_BASE, identifierSystemsOf } from "../identifiers"

const INSTANCE_BASE = "https://fhir.mou.cz/vulna"
const context = { systems: identifierSystemsOf(DEFAULT_CANONICAL_BASE), instanceBase: `${INSTANCE_BASE}/` }

const set: ClinicalCodeListSet = {
	version: "4",
	defaultLanguage: "cs",
	codeLists: [
		{
			code: "wound-type",
			title: "Typ rány",
			concepts: [
				{ code: "leg-ulcer", isActive: true, names: { cs: "Bércový vřed", en: "Leg ulcer" } },
				{ code: "old-type", isActive: false, names: { cs: "Starý typ" } },
			],
		},
		{ code: "document-title", title: "Název dokumentu", concepts: [] },
	],
}

const [woundTypes, documentTitles] = set.codeLists as [
	ClinicalCodeListSet["codeLists"][number],
	ClinicalCodeListSet["codeLists"][number],
]
const woundTypeUrls = codeListUrlsOf(context.instanceBase, woundTypes.code)
const documentTitleUrls = codeListUrlsOf(context.instanceBase, documentTitles.code)

describe("code lists published to the clinical record CAP-017-R20", () => {
	it("ADR-050 bod 7 places the code system and both value sets under the instance base", () => {
		expect(woundTypeUrls).toEqual({
			codeSystem: `${INSTANCE_BASE}/CodeSystem/wound-type`,
			valueSet: `${INSTANCE_BASE}/ValueSet/wound-type`,
			activeValueSet: `${INSTANCE_BASE}/ValueSet/wound-type-active`,
		})
	})

	it("CAP-017-S15 keeps a withdrawn item as an inactive concept with its stable code and names", () => {
		const codeSystem = codeSystemOf(woundTypes, set, woundTypeUrls, context)

		expect(codeSystem.url).toBe(`${INSTANCE_BASE}/CodeSystem/wound-type`)
		expect(codeSystem.version).toBe("4")
		expect(codeSystem.content).toBe("complete")
		expect(codeSystem.concept).toEqual([
			{
				code: "leg-ulcer",
				display: "Bércový vřed",
				designation: [
					{ language: "cs", value: "Bércový vřed" },
					{ language: "en", value: "Leg ulcer" },
				],
			},
			{
				code: "old-type",
				display: "Starý typ",
				designation: [{ language: "cs", value: "Starý typ" }],
				property: [{ code: "inactive", valueBoolean: true }],
			},
		])
	})

	it("ADR-050 bod 3 tags the projection version and the instance, without a language", () => {
		const codeSystem = codeSystemOf(woundTypes, set, woundTypeUrls, context)

		expect(codeSystem.meta).toEqual({
			tag: [{ system: `${DEFAULT_CANONICAL_BASE}/CodeSystem/vulna-projection`, code: "v1" }],
			source: INSTANCE_BASE,
		})
		expect(codeSystem.meta?.profile).toBeUndefined()
		expect(codeSystem.language).toBeUndefined()
	})

	it("publishes an empty code list without an empty concept list", () => {
		const codeSystem = codeSystemOf(documentTitles, set, documentTitleUrls, context)

		expect(codeSystem.count).toBe(0)
		expect(codeSystem).not.toHaveProperty("concept")
	})

	it("CAP-017-S15 offers only active items in the value set of choices and every item in the whole one", () => {
		expect(wholeValueSetOf(woundTypes, set, woundTypeUrls, context).compose).toEqual({
			inactive: true,
			include: [{ system: `${INSTANCE_BASE}/CodeSystem/wound-type`, version: "4" }],
		})
		expect(activeValueSetOf(woundTypes, set, woundTypeUrls, context)).toMatchObject({
			url: `${INSTANCE_BASE}/ValueSet/wound-type-active`,
			name: "WoundTypeActive",
			compose: { include: [{ concept: [{ code: "leg-ulcer" }] }] },
		})
	})

	it("publishes an empty list of choices without an empty concept list", () => {
		const included = { system: `${INSTANCE_BASE}/CodeSystem/document-title`, version: "4" }

		expect(activeValueSetOf(documentTitles, set, documentTitleUrls, context).compose).toEqual({
			include: [included],
			exclude: [included],
		})
	})
})
