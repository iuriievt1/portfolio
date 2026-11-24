import { describe, expect, it } from "vitest"
import {
	adapterKey,
	type ConfigurationSchema,
	composeConfigurationSchema,
	configurationDefaults,
	outboundTargetKeys,
} from "../configuration"

const core: ConfigurationSchema = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	type: "object",
	additionalProperties: false,
	properties: { session: { type: "object", additionalProperties: false, properties: {} } },
}

describe("configuration schema of the profile", () => {
	it("derives the adapter key from the package name", () => {
		expect(adapterKey("@ansora/vulna-adapter-dicom-dimse")).toBe("dicom_dimse")
		expect(adapterKey("@ansora/vulna-adapter-oidc")).toBe("oidc")
	})

	it("adds one closed object per adapter, sorted, with required keys", () => {
		const composed = composeConfigurationSchema(core, [
			{
				name: "@ansora/vulna-adapter-syslog",
				ports: [],
				processes: [],
				outboundCommunication: [],
				configurationSchema: {
					SYSLOG_HOST: { type: "string", required: true, description: "host" },
					SYSLOG_PORT: { type: "number" },
				},
			},
			{
				name: "@ansora/vulna-adapter-oidc",
				ports: [],
				processes: [],
				outboundCommunication: [],
				configurationSchema: {},
			},
		])
		expect(Object.keys(composed.properties)).toEqual(["session", "oidc", "syslog"])
		expect(composed.properties.syslog).toEqual({
			type: "object",
			additionalProperties: false,
			required: ["SYSLOG_HOST"],
			properties: { SYSLOG_HOST: { type: "string", description: "host" }, SYSLOG_PORT: { type: "number" } },
		})
		expect(composed.properties.oidc).toEqual({ type: "object", additionalProperties: false, properties: {} })
		expect(core.properties.syslog).toBeUndefined()
	})

	it("carries a closed list of values, limits, a pattern and a nullable type of an adapter key", () => {
		const composed = composeConfigurationSchema(core, [
			{
				name: "@ansora/vulna-adapter-syslog",
				ports: [],
				processes: [],
				outboundCommunication: [],
				configurationSchema: {
					SYSLOG_HOST: { type: ["string", "null"], default: null, pattern: "^\\S+$" },
					SYSLOG_PORT: { type: "integer", default: 6514, minimum: 1, maximum: 65_535 },
					SYSLOG_FORMAT: { type: "string", default: "rfc5424", enum: ["rfc5424", "rfc3164"] },
				},
			},
		])
		expect(composed.properties.syslog?.properties).toEqual({
			SYSLOG_HOST: { type: ["string", "null"], default: null, pattern: "^\\S+$" },
			SYSLOG_PORT: { type: "integer", default: 6514, minimum: 1, maximum: 65_535 },
			SYSLOG_FORMAT: { type: "string", default: "rfc5424", enum: ["rfc5424", "rfc3164"] },
		})
	})
})

describe("configuration defaults of the profile", () => {
	const schema: ConfigurationSchema = {
		type: "object",
		additionalProperties: false,
		properties: {
			session_policy: {
				type: "object",
				additionalProperties: false,
				properties: {
					session_max_seconds: { type: "integer", default: 28_800 },
					token_validity_seconds: { type: "integer" },
				},
			},
			mobile_app: {
				type: "object",
				additionalProperties: false,
				properties: { minimum_version: { type: ["string", "null"], default: null } },
			},
			dicom_dimse: {
				type: "object",
				additionalProperties: false,
				required: ["PACS_HOST"],
				properties: { PACS_HOST: { type: "string" } },
			},
		},
	}

	it("collects the defaults section by section and keeps null as a value", () => {
		expect(configurationDefaults(schema)).toEqual({
			session_policy: { session_max_seconds: 28_800 },
			mobile_app: { minimum_version: null },
		})
	})

	it("carries an adapter default into the composed schema", () => {
		const composed = composeConfigurationSchema(schema, [
			{
				name: "@ansora/vulna-adapter-registry-local",
				ports: [],
				processes: [],
				outboundCommunication: [],
				configurationSchema: { REGISTRY_WINDOW_DAYS_BACK: { type: "number", default: 7 } },
			},
		])
		expect(configurationDefaults(composed).registry_local).toEqual({ REGISTRY_WINDOW_DAYS_BACK: 7 })
	})
})

describe("outbound target keys", () => {
	it("lists the adapter keys flagged as outbound targets, sorted", () => {
		expect(
			outboundTargetKeys([
				{
					name: "@ansora/vulna-adapter-syslog",
					ports: [],
					processes: [],
					outboundCommunication: [],
					configurationSchema: {
						SYSLOG_PORT: { type: "number", outboundTarget: true },
						SYSLOG_HOST: { type: "string", outboundTarget: true },
						SYSLOG_FORMAT: { type: "string" },
					},
				},
			]),
		).toEqual(["syslog.SYSLOG_HOST", "syslog.SYSLOG_PORT"])
	})
})
