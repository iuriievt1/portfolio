import { CONFIGURATION_KEY, PATIENT_TAG_SOURCE } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import type { HpkeKeyService } from "../../../libs/hpke/hpke-key.service"
import type { ConfigurationService } from "../../configuration/services/configuration.service"
import type { LoginMethodOverridesRepository } from "../repositories/login-method-overrides.repository"
import { EffectiveConfigurationService } from "../services/effective-configuration.service"

const SYSTEM = "urn:vulna:synthetic:patient-id"
const DEVICE = { groupCode: null, loginMethods: {} }

function serviceWith(entries: [string, unknown][]) {
	const configuration = {
		effective: async () => ({ version: 3, values: new Map(entries) }),
	} as unknown as ConfigurationService
	const overrides = { ofGroup: async () => ({}) } as unknown as LoginMethodOverridesRepository
	const hpke = { serverHpkeKey: () => ({ server_key_version: "1", public_key: "key" }) } as unknown as HpkeKeyService
	return new EffectiveConfigurationService(configuration, overrides, hpke)
}

describe("patient identification in the effective configuration CAP-013-R03, CAP-013-R05", () => {
	it("gives the code system and the pattern", async () => {
		const configuration = await serviceWith([
			[CONFIGURATION_KEY.PATIENT_CODE_SYSTEM, SYSTEM],
			[CONFIGURATION_KEY.PATIENT_CODE_PATTERN, "^PID:(\\d+)$"],
		]).forDevice(DEVICE)

		expect(configuration.patient_code).toEqual({ system: SYSTEM, pattern: "^PID:(\\d+)$" })
	})

	it("gives the code system alone when no pattern is set", async () => {
		const configuration = await serviceWith([[CONFIGURATION_KEY.PATIENT_CODE_SYSTEM, SYSTEM]]).forDevice(DEVICE)

		expect(configuration.patient_code).toEqual({ system: SYSTEM })
	})

	it("CAP-013-S04 says that no tag mapping is set", async () => {
		const configuration = await serviceWith([[CONFIGURATION_KEY.PATIENT_TAG_SOURCE, null]]).forDevice(DEVICE)

		expect(configuration.patient_tag).toBeNull()
		expect(configuration.patient_code).toBeNull()
	})

	it("gives the tag mapping", async () => {
		const configuration = await serviceWith([
			[CONFIGURATION_KEY.PATIENT_TAG_SOURCE, PATIENT_TAG_SOURCE.UID],
			[CONFIGURATION_KEY.PATIENT_TAG_SYSTEM, SYSTEM],
		]).forDevice(DEVICE)

		expect(configuration.patient_tag).toEqual({ source: PATIENT_TAG_SOURCE.UID, system: SYSTEM })
	})
})

describe("clinical steps in the effective configuration CAP-017-R16", () => {
	it("says which clinical steps the instance switched on", async () => {
		const configuration = await serviceWith([
			[CONFIGURATION_KEY.ACQUISITION_WOUND_TYPE_ENABLED, true],
			[CONFIGURATION_KEY.ACQUISITION_HEALING_PHASE_ENABLED, false],
		]).forDevice(DEVICE)

		expect(configuration.wound_type_enabled).toBe(true)
		expect(configuration.healing_phase_enabled).toBe(false)
	})

	it("CAP-017-S16 keeps both steps off when the instance sets nothing", async () => {
		const configuration = await serviceWith([]).forDevice(DEVICE)

		expect(configuration.wound_type_enabled).toBe(false)
		expect(configuration.healing_phase_enabled).toBe(false)
	})
})

describe("local copies on the device in the effective configuration CAP-026-R08", () => {
	it("gives the period after which the device deletes a copy the server received", async () => {
		const configuration = await serviceWith([
			[CONFIGURATION_KEY.RETENTION_DEVICE_LOCAL_COPY_SECONDS, 86_400],
		]).forDevice(DEVICE)

		expect(configuration.device_local_copy_seconds).toBe(86_400)
	})
})
