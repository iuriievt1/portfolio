import { CONFIGURATION_KEY } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import type { ConfigurationItem } from "@/features/configuration/types/configuration.types"
import cs from "@/i18n/cs.json"
import { type EditValues, editValuesOf, formStateOf, sectionsFor } from "../lib/configuration-form"

const ROLE_MAPPING_STORED = [
	{ role: "clinician", group: "vulna-clinicians" },
	{ role: "administrator", group: "vulna-administrators" },
]

const ITEMS: ConfigurationItem[] = [
	{ key: CONFIGURATION_KEY.GROUP_TO_ROLE, value: ROLE_MAPPING_STORED },
	{ key: CONFIGURATION_KEY.ACQUISITION_MAX_IMAGES, value: 5 },
]

const STORAGE_ITEMS: ConfigurationItem[] = [
	{ key: CONFIGURATION_KEY.CLINICAL_RECORD_STORAGE_URL, value: "https://vulna.example.invalid/storage/" },
]

const IMPLEMENTATION_ITEMS: ConfigurationItem[] = [
	{ key: CONFIGURATION_KEY.DICOM_IMPLEMENTATION_CLASS_UID, value: null },
]
const IMPLEMENTATION_CLASS_UID = "1.2.826.0.1.3680043.10.1186"
const UID_MAX_LENGTH = 64
const LONGEST_UID = `1.${"2".repeat(UID_MAX_LENGTH - 2)}`

function stateOf(
	change: (edits: EditValues) => EditValues = (edits) => edits,
	items: readonly ConfigurationItem[] = ITEMS,
) {
	const sections = sectionsFor(items)
	return formStateOf(sections, items, change(editValuesOf(sections, items)))
}

function storageStateOf(address: string) {
	return stateOf((edits) => ({ ...edits, [CONFIGURATION_KEY.CLINICAL_RECORD_STORAGE_URL]: address }), STORAGE_ITEMS)
}

describe("changes of the configuration CAP-012-R19", () => {
	it("finds nothing to save in a role mapping the server returns with its keys in another order", () => {
		expect(stateOf().changes).toEqual([])
	})

	it("finds the role mapping the administrator changed", () => {
		const state = stateOf((edits) => ({
			...edits,
			[CONFIGURATION_KEY.GROUP_TO_ROLE]: [{ group: "vulna-clinicians", role: "administrator" }],
		}))

		expect(state.changes).toEqual([
			{ key: CONFIGURATION_KEY.GROUP_TO_ROLE, value: [{ group: "vulna-clinicians", role: "administrator" }] },
		])
	})

	it("finds only the field the administrator changed", () => {
		const state = stateOf((edits) => ({ ...edits, [CONFIGURATION_KEY.ACQUISITION_MAX_IMAGES]: "7" }))

		expect(state.changes).toEqual([{ key: CONFIGURATION_KEY.ACQUISITION_MAX_IMAGES, value: 7 }])
	})
})

describe("published storage address CAP-011-R02", () => {
	it("accepts an https address", () => {
		const state = storageStateOf("https://vulna.mou.cz/storage/")

		expect(state.errors).toEqual({})
		expect(state.changes).toEqual([
			{ key: CONFIGURATION_KEY.CLINICAL_RECORD_STORAGE_URL, value: "https://vulna.mou.cz/storage/" },
		])
	})

	it("refuses an http address with its own error", () => {
		expect(storageStateOf("http://vulna.mou.cz/storage/").errors).toEqual({
			[CONFIGURATION_KEY.CLINICAL_RECORD_STORAGE_URL]: cs.configuration.errors.secureUrl,
		})
	})
})

function implementationStateOf(uid: string) {
	return stateOf(
		(edits) => ({ ...edits, [CONFIGURATION_KEY.DICOM_IMPLEMENTATION_CLASS_UID]: uid }),
		IMPLEMENTATION_ITEMS,
	)
}

describe("Implementation Class UID CAP-012-R17", () => {
	it.each([IMPLEMENTATION_CLASS_UID, LONGEST_UID])("integrace-dicom.md 4 accepts %s and saves it", (uid) => {
		const state = implementationStateOf(uid)

		expect(state.errors).toEqual({})
		expect(state.changes).toEqual([{ key: CONFIGURATION_KEY.DICOM_IMPLEMENTATION_CLASS_UID, value: uid }])
	})

	it("leaves an empty UID unset", () => {
		expect(implementationStateOf("").changes).toEqual([])
	})

	it.each(["1.02.3", "3.1", "1", `${LONGEST_UID}2`])("refuses %s as no DICOM UID", (uid) => {
		expect(implementationStateOf(uid).errors).toEqual({
			[CONFIGURATION_KEY.DICOM_IMPLEMENTATION_CLASS_UID]: cs.configuration.errors.dicomUid,
		})
	})
})

const PACS_ITEMS: ConfigurationItem[] = [
	{ key: CONFIGURATION_KEY.PACS_HOST, value: null },
	{ key: CONFIGURATION_KEY.PACS_PORT, value: null },
	{ key: CONFIGURATION_KEY.PACS_AE_TITLE, value: null },
	{ key: CONFIGURATION_KEY.PACS_CALLING_AE_TITLE, value: null },
]

const PACS_CONNECTION = {
	[CONFIGURATION_KEY.PACS_HOST]: "pacs.mou.cz",
	[CONFIGURATION_KEY.PACS_PORT]: "104",
	[CONFIGURATION_KEY.PACS_AE_TITLE]: "AMISPACS",
	[CONFIGURATION_KEY.PACS_CALLING_AE_TITLE]: "ANSORA_VULNA",
}

function pacsStateOf(entered: Readonly<Record<string, string>>) {
	return stateOf((edits) => ({ ...edits, ...entered }), PACS_ITEMS)
}

describe("PACS connection CAP-012-R01", () => {
	it("CAP-012-S01 saves the address, port and both AE titles together", () => {
		const state = pacsStateOf(PACS_CONNECTION)

		expect(state.errors).toEqual({})
		expect(state.changes).toEqual([
			{ key: CONFIGURATION_KEY.PACS_HOST, value: "pacs.mou.cz" },
			{ key: CONFIGURATION_KEY.PACS_PORT, value: 104 },
			{ key: CONFIGURATION_KEY.PACS_AE_TITLE, value: "AMISPACS" },
			{ key: CONFIGURATION_KEY.PACS_CALLING_AE_TITLE, value: "ANSORA_VULNA" },
		])
	})

	it("CAP-012-S01 marks the parts missing from an address entered alone (negative)", () => {
		expect(pacsStateOf({ [CONFIGURATION_KEY.PACS_HOST]: "pacs.mou.cz" }).errors).toEqual({
			[CONFIGURATION_KEY.PACS_PORT]: cs.configuration.errors.pacsConnection,
			[CONFIGURATION_KEY.PACS_AE_TITLE]: cs.configuration.errors.pacsConnection,
			[CONFIGURATION_KEY.PACS_CALLING_AE_TITLE]: cs.configuration.errors.pacsConnection,
		})
	})

	it("leaves the connection unset while every part is empty", () => {
		const state = stateOf(undefined, PACS_ITEMS)

		expect(state.errors).toEqual({})
		expect(state.changes).toEqual([])
	})

	it.each(["AMIS\\PACS", "ABCDEFGHIJKLMNOPQ", "PACSČ"])("refuses the AE title %j", (aeTitle) => {
		const state = pacsStateOf({ ...PACS_CONNECTION, [CONFIGURATION_KEY.PACS_CALLING_AE_TITLE]: aeTitle })

		expect(state.errors).toEqual({ [CONFIGURATION_KEY.PACS_CALLING_AE_TITLE]: cs.configuration.errors.aeTitle })
	})

	it("saves an AE title without the spaces around it", () => {
		const state = pacsStateOf({ ...PACS_CONNECTION, [CONFIGURATION_KEY.PACS_AE_TITLE]: " AMISPACS " })

		expect(state.changes).toContainEqual({ key: CONFIGURATION_KEY.PACS_AE_TITLE, value: "AMISPACS" })
	})

	it("refuses a port that is not a whole number", () => {
		const state = pacsStateOf({ ...PACS_CONNECTION, [CONFIGURATION_KEY.PACS_PORT]: "104a" })

		expect(state.errors[CONFIGURATION_KEY.PACS_PORT]).toBe(cs.configuration.errors.wholeNumber)
	})
})

const JPEG_BASELINE = "1.2.840.10008.1.2.4.50"
const EXPLICIT_VR_LITTLE_ENDIAN = "1.2.840.10008.1.2.1"
const IMPLICIT_VR_LITTLE_ENDIAN = "1.2.840.10008.1.2"

const SYNTAX_ITEMS: ConfigurationItem[] = [
	{
		key: CONFIGURATION_KEY.DICOM_IMAGE_TRANSFER_SYNTAXES,
		value: [JPEG_BASELINE],
		allowed_values: [JPEG_BASELINE],
	},
	{
		key: CONFIGURATION_KEY.DICOM_DOCUMENT_TRANSFER_SYNTAXES,
		value: [IMPLICIT_VR_LITTLE_ENDIAN],
		allowed_values: [EXPLICIT_VR_LITTLE_ENDIAN, IMPLICIT_VR_LITTLE_ENDIAN],
	},
]

function syntaxStateOf(rows: readonly { transferSyntax: string; isChosen: boolean }[]) {
	return stateOf(
		(edits) => ({ ...edits, [CONFIGURATION_KEY.DICOM_DOCUMENT_TRANSFER_SYNTAXES]: { rows } }),
		SYNTAX_ITEMS,
	)
}

describe("transfer syntaxes CAP-021-R17, integrace-dicom.md 3", () => {
	it("shows the chosen syntaxes first in their order and offers the rest the profile allows", () => {
		const sections = sectionsFor(SYNTAX_ITEMS)

		expect(editValuesOf(sections, SYNTAX_ITEMS)[CONFIGURATION_KEY.DICOM_DOCUMENT_TRANSFER_SYNTAXES]).toEqual({
			rows: [
				{ transferSyntax: IMPLICIT_VR_LITTLE_ENDIAN, isChosen: true },
				{ transferSyntax: EXPLICIT_VR_LITTLE_ENDIAN, isChosen: false },
			],
		})
		expect(stateOf(undefined, SYNTAX_ITEMS).changes).toEqual([])
	})

	it("saves the chosen syntaxes in the order the administrator put them, as the PACS takes the first", () => {
		const state = syntaxStateOf([
			{ transferSyntax: EXPLICIT_VR_LITTLE_ENDIAN, isChosen: true },
			{ transferSyntax: IMPLICIT_VR_LITTLE_ENDIAN, isChosen: true },
		])

		expect(state.changes).toEqual([
			{
				key: CONFIGURATION_KEY.DICOM_DOCUMENT_TRANSFER_SYNTAXES,
				value: [EXPLICIT_VR_LITTLE_ENDIAN, IMPLICIT_VR_LITTLE_ENDIAN],
			},
		])
	})

	it("refuses a list with no syntax chosen", () => {
		const state = syntaxStateOf([
			{ transferSyntax: IMPLICIT_VR_LITTLE_ENDIAN, isChosen: false },
			{ transferSyntax: EXPLICIT_VR_LITTLE_ENDIAN, isChosen: false },
		])

		expect(state.errors).toEqual({
			[CONFIGURATION_KEY.DICOM_DOCUMENT_TRANSFER_SYNTAXES]: cs.configuration.errors.transferSyntaxRequired,
		})
	})
})

const RETENTION_ITEMS: ConfigurationItem[] = [
	{ key: CONFIGURATION_KEY.RETENTION_FULL_IMAGES_DAYS, value: 30, lower_limit: 1 },
	{ key: CONFIGURATION_KEY.RETENTION_THUMBNAILS_DAYS, value: null, lower_limit: 1 },
	{ key: CONFIGURATION_KEY.VIEWING_COPY_RETENTION_DAYS, value: null, lower_limit: 1 },
]

function retentionStateOf(entered: Readonly<Record<string, string>>) {
	return stateOf((edits) => ({ ...edits, ...entered }), RETENTION_ITEMS)
}

describe("periods of retention CAP-026-R02, CAP-026-R20, konfigurace-a-profily.md 2.4", () => {
	it("CAP-026-R20 offers the viewing copy period in the section of retention", () => {
		const [section] = sectionsFor(RETENTION_ITEMS)

		expect(section?.fields.map((field) => field.key)).toEqual(RETENTION_ITEMS.map((item) => item.key))
	})

	it("CAP-026-R02 saves a thumbnail period the administrator set and keeps an empty one unlimited", () => {
		expect(retentionStateOf({ [CONFIGURATION_KEY.RETENTION_THUMBNAILS_DAYS]: "365" }).changes).toEqual([
			{ key: CONFIGURATION_KEY.RETENTION_THUMBNAILS_DAYS, value: 365 },
		])
		expect(retentionStateOf({}).changes).toEqual([])
	})

	it("CAP-026-R20 takes an emptied viewing copy period back to unlimited", () => {
		const items = RETENTION_ITEMS.map((item) =>
			item.key === CONFIGURATION_KEY.VIEWING_COPY_RETENTION_DAYS ? { ...item, value: 90 } : item,
		)
		const state = stateOf((edits) => ({ ...edits, [CONFIGURATION_KEY.VIEWING_COPY_RETENTION_DAYS]: "" }), items)

		expect(state.changes).toEqual([{ key: CONFIGURATION_KEY.VIEWING_COPY_RETENTION_DAYS, value: null }])
	})

	it("CAP-026-R01 still requires the period of the originals", () => {
		expect(retentionStateOf({ [CONFIGURATION_KEY.RETENTION_FULL_IMAGES_DAYS]: "" }).errors).toEqual({
			[CONFIGURATION_KEY.RETENTION_FULL_IMAGES_DAYS]: cs.configuration.errors.required,
		})
	})
})
