import { describe, expect, it } from "vitest"
import type { DeviceDescriptor, SecureHardware } from "../../native"
import { DEVICE_STATUS, deviceStatusOfProblem, opensWorkingScreens, startsRegistration } from "../device-status"
import {
	currentDeviceStatus,
	type DeviceStateResponse,
	type EnrolmentApi,
	type EnrolmentKeys,
	enrolDevice,
} from "../enrolment"
import type { DeviceRegistrationRequest } from "../registration"

const FINGERPRINT = "K7Q2M-9XR4T"
const DESCRIPTOR: DeviceDescriptor = { model: "iPhone15,2", osVersion: "18.5", platform: "ios" }

function keysWith(secureHardware: SecureHardware = "secure_enclave"): EnrolmentKeys {
	return {
		deviceKey: async () => ({ publicKeyJwk: { kty: "EC", crv: "P-256", x: "x", y: "y" }, secureHardware }),
		deviceDescriptor: async () => DESCRIPTOR,
		signJws: async (header: string, payload: string) =>
			`${Buffer.from(header).toString("base64url")}.${Buffer.from(payload).toString("base64url")}.signature`,
		randomIdentifier: async () => "jti-1",
		approvalFingerprint: async () => FINGERPRINT,
	}
}

function apiWith(
	verify: () => Promise<DeviceStateResponse>,
	register: (request: DeviceRegistrationRequest) => Promise<DeviceStateResponse> = async () => ({
		state: "pending_approval",
	}),
): EnrolmentApi {
	return { verifyDevice: verify, registerDevice: register }
}

function rejected(code: string): () => Promise<DeviceStateResponse> {
	return async () => {
		throw Object.assign(new Error(code), { code })
	}
}

function claimsOf(request: DeviceRegistrationRequest): Record<string, unknown> {
	const payload = request.jws.split(".")[1]
	if (payload === undefined) {
		throw new Error("the registration request is not a compact JWS")
	}
	return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
}

describe("currentDeviceStatus", () => {
	it("CAP-006-S02 reports a waiting device with the fingerprint the administrator compares", async () => {
		const status = await currentDeviceStatus(
			apiWith(async () => ({ state: "pending_approval" })),
			keysWith(),
		)

		expect(status).toEqual({ kind: DEVICE_STATUS.PENDING_APPROVAL, fingerprint: FINGERPRINT })
		expect(opensWorkingScreens(status)).toBe(false)
	})

	it("CAP-006-S01 opens the working screens for an approved device", async () => {
		const status = await currentDeviceStatus(
			apiWith(async () => ({ state: "approved" })),
			keysWith(),
		)

		expect(status).toEqual({ kind: DEVICE_STATUS.APPROVED })
		expect(opensWorkingScreens(status)).toBe(true)
		expect(status.fingerprint).toBeUndefined()
	})

	it("CAP-007-S10 offers a new registration when the server does not know the device", async () => {
		const status = await currentDeviceStatus(apiWith(rejected("device-unknown")), keysWith())

		expect(status).toEqual({ kind: DEVICE_STATUS.UNREGISTERED })
		expect(startsRegistration(status)).toBe(true)
	})

	it("CAP-006-S14 reports a revoked device and CAP-008 a blocked one", async () => {
		expect(await currentDeviceStatus(apiWith(rejected("device-revoked")), keysWith())).toEqual({
			kind: DEVICE_STATUS.REVOKED,
		})
		expect(await currentDeviceStatus(apiWith(rejected("device-blocked")), keysWith())).toEqual({
			kind: DEVICE_STATUS.BLOCKED,
		})
	})

	it("CAP-002-R17 reports an unreachable server instead of guessing a state", async () => {
		expect(await currentDeviceStatus(apiWith(rejected("retry")), keysWith())).toEqual({
			kind: DEVICE_STATUS.UNREACHABLE,
		})
		expect(deviceStatusOfProblem({})).toEqual({ kind: DEVICE_STATUS.UNREACHABLE })
	})
})

describe("enrolDevice", () => {
	it("CAP-006-S02 registers a device without the managed configuration and waits for the administrator", async () => {
		let sent: DeviceRegistrationRequest | undefined
		const api = apiWith(rejected("device-unknown"), async (request) => {
			sent = request
			return { state: "pending_approval" as const }
		})

		const status = await enrolDevice(api, keysWith("keystore"))

		expect(status).toEqual({ kind: DEVICE_STATUS.PENDING_APPROVAL, fingerprint: FINGERPRINT })
		expect(claimsOf(sent as DeviceRegistrationRequest)).toMatchObject({
			model: DESCRIPTOR.model,
			os_version: DESCRIPTOR.osVersion,
			platform: DESCRIPTOR.platform,
			secure_hardware: "keystore",
			managed_configuration: false,
		})
	})

	it("CAP-006-S01 sends the registration secret and the group of the managed configuration", async () => {
		let sent: DeviceRegistrationRequest | undefined
		const api = apiWith(rejected("device-unknown"), async (request) => {
			sent = request
			return { state: "approved" as const }
		})

		const status = await enrolDevice(api, keysWith(), { registrationSecret: "secret", groupCode: "ambulance" })

		expect(status).toEqual({ kind: DEVICE_STATUS.APPROVED })
		expect(claimsOf(sent as DeviceRegistrationRequest)).toMatchObject({
			managed_configuration: true,
			registration_secret: "secret",
			group_code: "ambulance",
		})
	})

	it("CAP-006-S13 reports the blocked predecessor so the administrator reviews the registration", async () => {
		let sent: DeviceRegistrationRequest | undefined
		const api = apiWith(rejected("device-unknown"), async (request) => {
			sent = request
			return { state: "pending_approval" as const }
		})

		await enrolDevice(api, keysWith(), { registrationSecret: "secret", blockedPredecessorHwId: "hw-old" })

		expect(claimsOf(sent as DeviceRegistrationRequest)).toMatchObject({ blocked_predecessor_hw_id: "hw-old" })
	})
})
