import { type ConfigurationEntry, effectiveEntries, type Schema } from "@ansora/core-server"
import type { DimseSettings } from "@ansora/vulna-adapter-dicom-dimse"
import type { RegistrySourcePort } from "@ansora/vulna-domain"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { EnvVariable } from "../../../libs/common/constants/env-variable.constants"
import { EnvVariableService } from "../../../libs/common/services/env-variable.service"
import type { ConfigurationService } from "../../../libs/configuration/configuration.service"
import { ImplementationIdentityService } from "../../../libs/pacs/implementation-identity.service"
import { PacsSettingsService } from "../../../libs/pacs/pacs-settings.service"
import { RegistrySourceService } from "../services/registry-source.service"

const SCHEMA: Schema = {
	type: "object",
	additionalProperties: false,
	properties: {
		dicom_dimse: {
			type: "object",
			additionalProperties: false,
			properties: {
				PACS_HOST: { type: "string" },
				PACS_PORT: { type: "number" },
				PACS_AE_TITLE: { type: "string" },
				PACS_CALLING_AE_TITLE: { type: "string" },
				PACS_WORKLIST_MODALITY: { type: "string" },
			},
		},
		dicom: {
			type: "object",
			additionalProperties: false,
			properties: {
				implementation_class_uid: { type: ["string", "null"], default: null },
				connect_timeout_seconds: { type: "integer", default: 10 },
				acse_timeout_seconds: { type: "integer", default: 30 },
				dimse_timeout_seconds: { type: "integer", default: 120 },
				idle_timeout_seconds: { type: "integer", default: 300 },
				max_pdu_length: { type: "integer", default: 16_384 },
			},
		},
	},
}

const IMPLEMENTATION_CLASS_UID = "2.25.114121808482181632410403048131802259005"
const RELEASE = "1.4.0"

const CONNECTION: ConfigurationEntry[] = [
	["dicom_dimse.PACS_HOST", "pacs.hospital.example"],
	["dicom_dimse.PACS_PORT", 104],
	["dicom_dimse.PACS_AE_TITLE", "AMIS"],
	["dicom_dimse.PACS_CALLING_AE_TITLE", "ANSORA_VULNA"],
	["dicom.implementation_class_uid", IMPLEMENTATION_CLASS_UID],
]

function sourceWith(entries: ConfigurationEntry[]) {
	const built: DimseSettings[] = []
	const configuration = {
		effectiveValues: async () => new Map(effectiveEntries(SCHEMA, entries)),
	} as unknown as ConfigurationService
	const pacs = new PacsSettingsService(new ImplementationIdentityService(new EnvVariableService()))
	const service = new RegistrySourceService(configuration, pacs, (settings) => {
		built.push(settings)
		return {} as RegistrySourcePort
	})
	return { service, built }
}

beforeEach(() => {
	vi.stubEnv(EnvVariable.SERVER_VERSION, RELEASE)
})

afterEach(() => {
	vi.unstubAllEnvs()
})

describe("registry source from the instance configuration ADR-035 bod 4, CAP-024-R14", () => {
	it("builds the PACS connection without a modality filter by default", async () => {
		const { service, built } = sourceWith(CONNECTION)

		expect(await service.current()).toBeDefined()
		expect(built).toEqual([
			{
				host: "pacs.hospital.example",
				port: 104,
				pacsAeTitle: "AMIS",
				callingAeTitle: "ANSORA_VULNA",
				worklistModality: undefined,
				identity: { implementationClassUid: IMPLEMENTATION_CLASS_UID, implementationVersionName: RELEASE },
				timeouts: { connectMs: 10_000, acseMs: 30_000, dimseMs: 120_000, idleMs: 300_000 },
				maxPduLength: 16_384,
			},
		])
	})

	it("passes the worklist modality the administrator set", async () => {
		const { service, built } = sourceWith([...CONNECTION, ["dicom_dimse.PACS_WORKLIST_MODALITY", "XC"]])

		await service.current()

		expect(built[0]?.worklistModality).toBe("XC")
	})

	it("has no source while the PACS connection is not configured", async () => {
		const { service, built } = sourceWith(CONNECTION.slice(1))

		expect(await service.current()).toBeUndefined()
		expect(built).toEqual([])
	})

	it("CAP-012-R17 has no source while the association has no Implementation Class UID to present", async () => {
		const { service, built } = sourceWith(CONNECTION.filter(([key]) => key !== "dicom.implementation_class_uid"))

		expect(await service.current()).toBeUndefined()
		expect(built).toEqual([])
	})
})
