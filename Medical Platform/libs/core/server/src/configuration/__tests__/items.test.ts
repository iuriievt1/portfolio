import { describe, expect, it } from "vitest"
import { configurationItems, configurationProperty, effectiveEntries, isProfileOnly } from "../items"
import type { Schema } from "../schema"

const EXPLICIT_VR_LITTLE_ENDIAN = "1.2.840.10008.1.2.1"
const IMPLICIT_VR_LITTLE_ENDIAN = "1.2.840.10008.1.2"

const schema: Schema = {
	type: "object",
	additionalProperties: false,
	properties: {
		pin_policy: {
			type: "object",
			additionalProperties: false,
			properties: { min_length: { type: "integer", default: 6, minimum: 4, maximum: 8 } },
		},
		mobile_app: {
			type: "object",
			additionalProperties: false,
			properties: { minimum_version: { type: ["string", "null"], default: null } },
		},
		api: {
			type: "object",
			additionalProperties: false,
			properties: { page_size_max: { type: "integer", default: 500, minimum: 1, readOnly: true } },
		},
		syslog: {
			type: "object",
			additionalProperties: false,
			properties: {
				SYSLOG_HOST: { type: ["string", "null"], default: null },
				SYSLOG_CA: { type: "string" },
				SYSLOG_FORMAT: { type: "string", enum: ["rfc5424", "rfc3164"] },
			},
		},
		dicom: {
			type: "object",
			additionalProperties: false,
			properties: {
				document_transfer_syntaxes: {
					type: "array",
					minItems: 1,
					uniqueItems: true,
					items: { type: "string", enum: [EXPLICIT_VR_LITTLE_ENDIAN, IMPLICIT_VR_LITTLE_ENDIAN] },
				},
			},
		},
	},
}

describe("configuration items", () => {
	const itemOf = (key: string, entries: [string, unknown][]) =>
		configurationItems(schema, entries).find((item) => item.key === key)

	it("carries the default and the limits of each key from the schema", () => {
		expect(itemOf("pin_policy.min_length", [["pin_policy.min_length", 7]])).toEqual({
			key: "pin_policy.min_length",
			value: 7,
			owner: "server",
			default_value: 6,
			lower_limit: 4,
			upper_limit: 8,
		})
	})

	it("keeps a null default and leaves out limits the schema does not set", () => {
		expect(itemOf("mobile_app.minimum_version", [["mobile_app.minimum_version", null]])).toEqual({
			key: "mobile_app.minimum_version",
			value: null,
			owner: "server",
			default_value: null,
		})
	})

	it("leaves out an internal limit that only a new profile release changes", () => {
		expect(isProfileOnly(schema, "api.page_size_max")).toBe(true)
		expect(isProfileOnly(schema, "pin_policy.min_length")).toBe(false)
		expect(
			configurationItems(schema, [
				["pin_policy.min_length", 6],
				["api.page_size_max", 500],
			]).map((item) => item.key),
		).not.toContain("api.page_size_max")
	})

	it("offers a key added by a newer profile with its default until a version stores it", () => {
		expect(effectiveEntries(schema, [["pin_policy.min_length", 7]])).toEqual([
			["pin_policy.min_length", 7],
			["mobile_app.minimum_version", null],
			["api.page_size_max", 500],
			["syslog.SYSLOG_HOST", null],
		])
		expect(
			configurationItems(schema, [["syslog.SYSLOG_HOST", "logs.hospital.example"]]).map((item) => item.key),
		).toEqual(["syslog.SYSLOG_HOST", "pin_policy.min_length", "mobile_app.minimum_version"])
	})

	it("CAP-021-R17 offers the values each item of a list may take, in the order of the profile", () => {
		expect(
			itemOf("dicom.document_transfer_syntaxes", [["dicom.document_transfer_syntaxes", [IMPLICIT_VR_LITTLE_ENDIAN]]]),
		).toEqual({
			key: "dicom.document_transfer_syntaxes",
			value: [IMPLICIT_VR_LITTLE_ENDIAN],
			owner: "server",
			allowed_values: [EXPLICIT_VR_LITTLE_ENDIAN, IMPLICIT_VR_LITTLE_ENDIAN],
		})
	})

	it("offers the values of a closed choice and none for a free value", () => {
		expect(itemOf("syslog.SYSLOG_FORMAT", [["syslog.SYSLOG_FORMAT", "rfc5424"]])?.allowed_values).toEqual([
			"rfc5424",
			"rfc3164",
		])
		expect(itemOf("syslog.SYSLOG_CA", [["syslog.SYSLOG_CA", "ca"]])).not.toHaveProperty("allowed_values")
	})

	it("returns a key the schema does not know without default or limits", () => {
		expect(configurationProperty(schema, "other.key")).toBeUndefined()
		expect(itemOf("other.key", [["other.key", 1]])).toEqual({ key: "other.key", value: 1, owner: "server" })
	})
})
