import { readBodyDiagramSvg } from "@ansora/contracts"
import { CURRENT_BODY_DIAGRAM } from "@ansora/vulna-domain"
import { HEADERS_METADATA } from "@nestjs/common/constants"
import { describe, expect, it } from "vitest"
import type { DatabaseService } from "../../../libs/database/database.service"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import type { LocalizationService } from "../../localization/localization.service"
import type { NameLanguages } from "../../localization/types/localization.types"
import { BodyDiagramController } from "../controllers/body-diagram.controller"
import type { CodeListRepository } from "../repositories/code-list.repository"
import type { CodeListSetRepository } from "../repositories/code-list-set.repository"
import { CodeListService } from "../services/code-list.service"
import type { StoredCodeListItem } from "../types/code-list.types"
import { backgroundUrl } from "../utils/body-diagram-view"

const HEEL = "84607009"
const CZECH: NameLanguages = { response: "cs", instanceDefault: "cs" }
const ENGLISH: NameLanguages = { response: "en", instanceDefault: "cs" }
const SET_VERSION = 4

const ITEMS: StoredCodeListItem[] = [
	{
		id: "i1",
		codeListCode: "wound-type",
		code: "leg-ulcer",
		sequence: 1,
		isActive: true,
		names: { cs: "Bércový vřed", en: "Leg ulcer" },
	},
	{ id: "i2", codeListCode: "wound-type", code: "old-type", sequence: 2, isActive: false, names: { cs: "Starý typ" } },
	{ id: "i3", codeListCode: "healing-phase", code: "sloughy", sequence: 1, isActive: true, names: { cs: "Povleklá" } },
]

function serviceAnswering(languages: NameLanguages): CodeListService {
	const localization = { nameLanguages: async () => languages } as unknown as LocalizationService
	const database = { sql: {} } as unknown as DatabaseService
	const codeLists = { items: async () => ITEMS } as unknown as CodeListRepository
	const sets = {
		current: async () => ({ id: "s4", version: SET_VERSION, body_diagram_version: CURRENT_BODY_DIAGRAM.version }),
	} as unknown as CodeListSetRepository
	return new CodeListService(database, codeLists, sets, localization)
}

describe("code list set", () => {
	it("CAP-016-S12 names regions in the requested language and keeps every name", async () => {
		const { set, contentLanguage } = await serviceAnswering(ENGLISH).codeListSet(undefined, "en")
		const heel = set.body_diagram.regions.find((region) => region.code === HEEL)
		expect(contentLanguage).toBe("en")
		expect(heel?.name).toBe("Skin of heel")
		expect(heel?.names).toEqual({ cs: "Pata", en: "Skin of heel" })
		expect(heel?.is_paired).toBe(true)
		expect(heel?.views).toEqual(["right_lateral", "plantar", "posterior", "left_lateral"])
	})

	it("CAP-016-R07 points the app to the background of the same version", async () => {
		const { set } = await serviceAnswering(CZECH).codeListSet(undefined, undefined)
		expect(set.body_diagram.version).toBe(CURRENT_BODY_DIAGRAM.version)
		expect(set.body_diagram.background_url).toBe(`/body-diagrams/${CURRENT_BODY_DIAGRAM.version}/background`)
		expect(set.body_diagram.regions).toHaveLength(CURRENT_BODY_DIAGRAM.regions.length)
	})

	it("CAP-017-S07 offers every item with all its names and the name of the requested language", async () => {
		const { set } = await serviceAnswering(ENGLISH).codeListSet(undefined, "en")

		expect(set.version).toBe(String(SET_VERSION))
		expect(set.wound_types).toEqual([
			{ code: "leg-ulcer", text: "Leg ulcer", names: { cs: "Bércový vřed", en: "Leg ulcer" }, is_selectable: true },
			{ code: "old-type", text: "Starý typ", names: { cs: "Starý typ" }, is_selectable: false },
		])
		expect(set.healing_phases).toEqual([
			{ code: "sloughy", text: "Povleklá", names: { cs: "Povleklá" }, is_selectable: true },
		])
		expect(set.document_titles).toEqual([])
	})

	it("answers without regions when the device already has the version", async () => {
		const service = serviceAnswering(CZECH)
		const { set: first } = await service.codeListSet(undefined, undefined)
		const { set: again } = await service.codeListSet(first.version, undefined)
		expect(again.version).toBe(first.version)
		expect(again.body_diagram.regions).toEqual([])
		expect(again.wound_types).toEqual([])
	})
})

describe("body diagram background", () => {
	const controller = new BodyDiagramController()

	it("CAP-016-R08 serves the vector background of a known version", () => {
		const svg = controller.getBodyDiagramBackground(CURRENT_BODY_DIAGRAM.version)
		expect(Reflect.getMetadata(HEADERS_METADATA, BodyDiagramController.prototype.getBodyDiagramBackground)).toEqual([
			{ name: "Content-Type", value: "image/svg+xml" },
		])
		expect(readBodyDiagramSvg(svg).version).toBe(CURRENT_BODY_DIAGRAM.version)
	})

	it("answers 404 for a version the server does not have", () => {
		expect(() => controller.getBodyDiagramBackground("0")).toThrow(ProblemException)
	})

	it("escapes the version in the background address", () => {
		expect(backgroundUrl("1/2")).toBe("/body-diagrams/1%2F2/background")
	})
})
