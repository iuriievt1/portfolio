import { ADMINISTRATION_ERROR_CODE } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { applyConfigurationChange, type CurrentConfiguration } from "../change"
import type { Schema } from "../schema"

const integer = (limits: { minimum?: number; maximum?: number } = {}): Schema => ({ type: "integer", ...limits })
const section = (properties: Record<string, Schema>): Schema => ({
	type: "object",
	additionalProperties: false,
	properties,
})

const schema: Schema = {
	type: "object",
	additionalProperties: false,
	properties: {
		localization: section({
			default_language: { type: "string" },
			supported_languages: { type: "array", minItems: 1, uniqueItems: true, items: { type: "string" } },
		}),
		login_methods: section({
			card: { type: "boolean" },
			qr: { type: "boolean" },
			barcode: { type: "boolean" },
			pin: { type: "boolean" },
		}),
		pin_policy: section({ min_length: integer({ minimum: 4, maximum: 8 }) }),
		session_policy: section({
			session_max_seconds: integer({ minimum: 1 }),
			token_validity_seconds: integer({ minimum: 1 }),
		}),
		dicom_dimse: section({
			PACS_HOST: { type: ["string", "null"] },
			PACS_PORT: { type: ["integer", "null"], minimum: 1, maximum: 65_535 },
			PACS_AE_TITLE: { type: ["string", "null"] },
			PACS_CALLING_AE_TITLE: { type: ["string", "null"] },
		}),
		clinical_record_medplum: section({ MEDPLUM_BASE_URL: { type: "string" }, STORAGE_URL: { type: "string" } }),
		patient_identification: section({
			code_system: { type: ["string", "null"] },
			code_pattern: { type: ["string", "null"] },
			nfc_source: { type: ["string", "null"], enum: ["ndef_text", "uid", null] },
			nfc_system: { type: ["string", "null"] },
		}),
		api: section({ page_size_max: { ...integer({ minimum: 1 }), readOnly: true } }),
	},
}

const current: CurrentConfiguration = {
	version: 7,
	entries: [
		["localization.default_language", "cs"],
		["localization.supported_languages", ["cs", "en"]],
		["login_methods.card", true],
		["login_methods.qr", true],
		["login_methods.barcode", true],
		["login_methods.pin", true],
		["pin_policy.min_length", 6],
		["session_policy.session_max_seconds", 28_800],
		["session_policy.token_validity_seconds", 900],
		["dicom_dimse.PACS_HOST", "pacs.hospital.example"],
		["dicom_dimse.PACS_PORT", 104],
		["dicom_dimse.PACS_AE_TITLE", "AMISPACS"],
		["dicom_dimse.PACS_CALLING_AE_TITLE", "ANSORA_VULNA"],
		["api.page_size_max", 500],
	],
}

const PACS_CONNECTION: [string, unknown][] = [
	["dicom_dimse.PACS_HOST", "pacs.hospital.example"],
	["dicom_dimse.PACS_PORT", 104],
	["dicom_dimse.PACS_AE_TITLE", "AMISPACS"],
	["dicom_dimse.PACS_CALLING_AE_TITLE", "ANSORA_VULNA"],
]

const withoutPacs: CurrentConfiguration = {
	version: current.version,
	entries: current.entries.filter(([key]) => !key.startsWith("dicom_dimse.")),
}

const outboundTargetKeys = ["dicom_dimse.PACS_HOST", "clinical_record_medplum.MEDPLUM_BASE_URL"]

function apply(changes: [string, unknown][], expectedVersion = current.version) {
	return applyConfigurationChange(current, { expectedVersion, changes }, schema, outboundTargetKeys)
}

describe("configuration change", () => {
	it("CAP-012-S01 creates the next version with the changed value and keeps the other values", () => {
		const outcome = apply([["pin_policy.min_length", 7]])
		expect(outcome.ok).toBe(true)
		if (!outcome.ok) {
			return
		}
		expect(outcome.version).toBe(8)
		expect(new Map(outcome.entries).get("pin_policy.min_length")).toBe(7)
		expect(new Map(outcome.entries).get("login_methods.card")).toBe(true)
		expect(outcome.warnings).toEqual([])
	})

	it("CAP-012-S12 rejects a change prepared over a stale version with version-conflict", () => {
		const outcome = apply([["pin_policy.min_length", 7]], 6)
		expect(outcome).toMatchObject({ ok: false, code: ADMINISTRATION_ERROR_CODE.VERSION_CONFLICT })
	})

	it("CAP-001-S27 rejects a PIN minimum length outside 4 to 8 with value-out-of-range", () => {
		for (const length of [3, 9]) {
			const outcome = apply([["pin_policy.min_length", length]])
			expect(outcome).toMatchObject({ ok: false, code: ADMINISTRATION_ERROR_CODE.VALUE_OUT_OF_RANGE })
			if (!outcome.ok) {
				expect(outcome.problems[0]).toContain("pin_policy.min_length")
			}
		}
	})

	it("CAP-012-S18 rejects a default language outside the supported languages", () => {
		const outcome = apply([["localization.default_language", "de"]])
		expect(outcome).toMatchObject({ ok: false, code: ADMINISTRATION_ERROR_CODE.DEFAULT_LANGUAGE_NOT_SUPPORTED })
	})

	it("CAP-012-S04 accepts disabling all quick login methods and warns about it", () => {
		const outcome = apply([
			["login_methods.card", false],
			["login_methods.qr", false],
			["login_methods.barcode", false],
			["login_methods.pin", false],
		])
		expect(outcome.ok).toBe(true)
		if (outcome.ok) {
			expect(outcome.warnings).toEqual([
				{
					code: "all_quick_login_methods_disabled",
					keys: ["login_methods.card", "login_methods.qr", "login_methods.barcode", "login_methods.pin"],
				},
			])
		}
	})

	it("CAP-012-S17 warns that the outbound allowlist needs an update when a target address changes", () => {
		const changed = apply([["dicom_dimse.PACS_HOST", "pacs-new.hospital.example"]])
		expect(changed.ok).toBe(true)
		if (changed.ok) {
			expect(changed.warnings).toEqual([
				{ code: "outbound_allowlist_update_required", keys: ["dicom_dimse.PACS_HOST"] },
			])
		}
		const unchanged = apply([["dicom_dimse.PACS_HOST", "pacs.hospital.example"]])
		expect(unchanged.ok && unchanged.warnings).toEqual([])
	})

	it("rejects an unknown key and a key without a section", () => {
		expect(apply([["pin_policy.unknown", 1]])).toMatchObject({
			ok: false,
			code: ADMINISTRATION_ERROR_CODE.VALUE_OUT_OF_RANGE,
		})
		expect(apply([["min_length", 6]])).toMatchObject({ ok: false, code: ADMINISTRATION_ERROR_CODE.VALUE_OUT_OF_RANGE })
	})

	it("rejects a change of an internal limit that only a new profile release changes", () => {
		const outcome = apply([["api.page_size_max", 1000]])
		expect(outcome).toMatchObject({ ok: false, code: ADMINISTRATION_ERROR_CODE.VALUE_OUT_OF_RANGE })
		if (!outcome.ok) {
			expect(outcome.problems).toEqual(["api.page_size_max: changes only with a new profile release"])
		}
	})

	it("rejects a token validity longer than the session", () => {
		const outcome = apply([["session_policy.token_validity_seconds", 30_000]])
		expect(outcome).toMatchObject({ ok: false, code: ADMINISTRATION_ERROR_CODE.VALUE_OUT_OF_RANGE })
	})

	describe("patient identification CAP-013-R03, CAP-013-R05", () => {
		const SYSTEM = "urn:vulna:synthetic:patient-id"

		it("accepts a code system with a pattern that captures the identifier", () => {
			const outcome = apply([
				["patient_identification.code_system", SYSTEM],
				["patient_identification.code_pattern", "^PID:(\\d+)$"],
			])
			expect(outcome.ok).toBe(true)
		})

		it("refuses a pattern without a capturing group", () => {
			const outcome = apply([
				["patient_identification.code_system", SYSTEM],
				["patient_identification.code_pattern", "^\\d+$"],
			])
			expect(outcome).toMatchObject({ ok: false, code: ADMINISTRATION_ERROR_CODE.VALUE_OUT_OF_RANGE })
		})

		it("refuses a pattern that is not a regular expression", () => {
			const outcome = apply([
				["patient_identification.code_system", SYSTEM],
				["patient_identification.code_pattern", "(unclosed"],
			])
			expect(outcome).toMatchObject({ ok: false, code: ADMINISTRATION_ERROR_CODE.VALUE_OUT_OF_RANGE })
		})

		it("refuses a pattern without a code system", () => {
			const outcome = apply([["patient_identification.code_pattern", "^(\\d+)$"]])
			expect(outcome).toMatchObject({ ok: false, code: ADMINISTRATION_ERROR_CODE.VALUE_OUT_OF_RANGE })
		})

		it("refuses a tag source without a tag system", () => {
			const outcome = apply([["patient_identification.nfc_source", "uid"]])
			expect(outcome).toMatchObject({ ok: false, code: ADMINISTRATION_ERROR_CODE.VALUE_OUT_OF_RANGE })
		})

		it("accepts a complete tag mapping", () => {
			const outcome = apply([
				["patient_identification.nfc_source", "ndef_text"],
				["patient_identification.nfc_system", SYSTEM],
			])
			expect(outcome.ok).toBe(true)
		})
	})

	describe("PACS connection CAP-012-R01", () => {
		const applyWithoutPacs = (changes: [string, unknown][]) =>
			applyConfigurationChange(
				withoutPacs,
				{ expectedVersion: withoutPacs.version, changes },
				schema,
				outboundTargetKeys,
			)

		it("CAP-012-S01 accepts the address, port and both AE titles saved together", () => {
			const outcome = applyWithoutPacs(PACS_CONNECTION)
			expect(outcome).toMatchObject({
				ok: true,
				warnings: [{ code: "outbound_allowlist_update_required", keys: ["dicom_dimse.PACS_HOST"] }],
			})
		})

		it("CAP-012-S01 refuses an address without the port and the AE titles (negative)", () => {
			const outcome = applyWithoutPacs([["dicom_dimse.PACS_HOST", "pacs.hospital.example"]])
			expect(outcome).toMatchObject({ ok: false, code: ADMINISTRATION_ERROR_CODE.VALUE_OUT_OF_RANGE })
		})

		it("refuses to clear one part of a configured connection (negative)", () => {
			const outcome = apply([["dicom_dimse.PACS_CALLING_AE_TITLE", null]])
			expect(outcome).toMatchObject({ ok: false, code: ADMINISTRATION_ERROR_CODE.VALUE_OUT_OF_RANGE })
		})

		it("accepts clearing the whole connection, which leaves the delivery waiting", () => {
			const outcome = apply(PACS_CONNECTION.map(([key]) => [key, null]))
			expect(outcome.ok).toBe(true)
		})

		it("refuses a port outside the TCP range", () => {
			expect(apply([["dicom_dimse.PACS_PORT", 0]])).toMatchObject({ ok: false })
			expect(apply([["dicom_dimse.PACS_PORT", 65_536]])).toMatchObject({ ok: false })
		})
	})

	describe("clinical record store CAP-012-R30", () => {
		it("CAP-012-S17 accepts the address of the store and asks for the allowlist", () => {
			const outcome = apply([["clinical_record_medplum.MEDPLUM_BASE_URL", "http://127.0.0.1:8103/"]])
			expect(outcome).toMatchObject({
				ok: true,
				warnings: [{ code: "outbound_allowlist_update_required", keys: ["clinical_record_medplum.MEDPLUM_BASE_URL"] }],
			})
		})

		it("refuses an address that is not a web address", () => {
			const outcome = apply([["clinical_record_medplum.MEDPLUM_BASE_URL", "127.0.0.1:8103"]])
			expect(outcome).toMatchObject({ ok: false, code: ADMINISTRATION_ERROR_CODE.VALUE_OUT_OF_RANGE })
		})

		it("refuses an address that is neither http nor https", () => {
			const outcome = apply([["clinical_record_medplum.MEDPLUM_BASE_URL", "ftp://127.0.0.1:8103/"]])
			expect(outcome).toMatchObject({ ok: false, code: ADMINISTRATION_ERROR_CODE.VALUE_OUT_OF_RANGE })
		})

		it("accepts the published storage address over TLS", () => {
			const outcome = apply([["clinical_record_medplum.STORAGE_URL", "https://vulna.example.invalid/storage/"]])
			expect(outcome.ok).toBe(true)
		})

		it("refuses a published storage address without TLS", () => {
			const outcome = apply([["clinical_record_medplum.STORAGE_URL", "http://vulna.example.invalid/storage/"]])
			expect(outcome).toMatchObject({ ok: false, code: ADMINISTRATION_ERROR_CODE.VALUE_OUT_OF_RANGE })
		})
	})
})
