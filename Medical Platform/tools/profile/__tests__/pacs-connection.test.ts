import { readFileSync } from "node:fs"
import { DICOM_AE_TITLE_PATTERN, HOST_NAME_PATTERN } from "@ansora/contracts"
import { validate } from "@ansora/core-server"
import { describe, expect, it } from "vitest"
import { type ConfigurationSchema, composeConfigurationSchema, configurationDefaults } from "../configuration"
import type { AdapterManifest } from "../model"

const MANIFEST = new URL("../../../libs/modules/vulna/adapter-dicom-dimse/manifest.json", import.meta.url)
const manifest: AdapterManifest = JSON.parse(readFileSync(MANIFEST, "utf8"))

const core: ConfigurationSchema = { type: "object", additionalProperties: false, properties: {} }
const schema = composeConfigurationSchema(core, [manifest])
const connection = schema.properties.dicom_dimse

const CONFIGURED = {
	PACS_HOST: "pacs.hospital.example",
	PACS_PORT: 104,
	PACS_AE_TITLE: "AMISPACS",
	PACS_CALLING_AE_TITLE: "ANSORA_VULNA",
}

function isAccepted(values: Record<string, unknown>): boolean {
	return connection !== undefined && validate({ ...CONFIGURED, ...values }, connection).length === 0
}

describe("PACS connection of the DICOM adapter CAP-012-R01, konfigurace-a-profily.md 2.1", () => {
	it("keeps the patterns of the manifest equal to the contract the administration checks with", () => {
		const items = manifest.configurationSchema ?? {}
		expect(items.PACS_AE_TITLE?.pattern).toBe(DICOM_AE_TITLE_PATTERN.source)
		expect(items.PACS_CALLING_AE_TITLE?.pattern).toBe(DICOM_AE_TITLE_PATTERN.source)
		expect(items.PACS_HOST?.pattern).toBe(HOST_NAME_PATTERN.source)
	})

	it("starts without a connection, so the delivery waits until the administrator sets it", () => {
		expect(configurationDefaults(schema).dicom_dimse).toEqual({
			PACS_HOST: null,
			PACS_PORT: null,
			PACS_AE_TITLE: null,
			PACS_CALLING_AE_TITLE: null,
		})
		expect(isAccepted({ PACS_HOST: null, PACS_PORT: null, PACS_AE_TITLE: null, PACS_CALLING_AE_TITLE: null })).toBe(
			true,
		)
	})

	it.each(["A", "AMISPACS", "ANSORA_VULNA", "PACS 1", "ABCDEFGHIJKLMNOP"])(
		"CAP-012-S01 accepts the AE title %j",
		(aeTitle) => {
			expect(isAccepted({ PACS_AE_TITLE: aeTitle, PACS_CALLING_AE_TITLE: aeTitle })).toBe(true)
		},
	)

	it.each(["", " PACS", "PACS ", "PACS\\1", "ABCDEFGHIJKLMNOPQ", "PACSČ", "PACS\t1"])(
		"refuses the AE title %j (negative)",
		(aeTitle) => {
			expect(isAccepted({ PACS_AE_TITLE: aeTitle })).toBe(false)
			expect(isAccepted({ PACS_CALLING_AE_TITLE: aeTitle })).toBe(false)
		},
	)

	it.each(["pacs.hospital.example", "10.20.30.40", "[fd00::1]"])("accepts the address %j", (host) => {
		expect(isAccepted({ PACS_HOST: host })).toBe(true)
	})

	it.each(["", "pacs hospital", "pacs.hospital.example/dicom"])("refuses the address %j (negative)", (host) => {
		expect(isAccepted({ PACS_HOST: host })).toBe(false)
	})

	it.each([0, 65_536, 104.5])("refuses the port %j (negative)", (port) => {
		expect(isAccepted({ PACS_PORT: port })).toBe(false)
	})
})
