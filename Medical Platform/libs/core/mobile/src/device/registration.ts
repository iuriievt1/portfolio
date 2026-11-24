import type { MobileContract } from "@ansora/contracts"
import type { DeviceDescriptor, SecureHardware } from "../native"
import { epochSeconds, type JwsSigner, signBody } from "./device-proof"

export type DeviceRegistrationRequest = MobileContract.components["schemas"]["DeviceRegistrationRequest"]

export type DeviceState = MobileContract.components["schemas"]["DeviceState"]

export interface RegistrationInput {
	descriptor: DeviceDescriptor
	secureHardware: SecureHardware
	managedConfiguration: boolean
	registrationSecret?: string
	groupCode?: string
	blockedPredecessorHwId?: string
}

export interface RegistrationClaims {
	model: string
	os_version: string
	platform: DeviceDescriptor["platform"]
	secure_hardware: SecureHardware
	managed_configuration: boolean
	registration_secret?: string
	group_code?: string
	blocked_predecessor_hw_id?: string
	iat: number
}

export function registrationClaims(input: RegistrationInput, issuedAt: Date): RegistrationClaims {
	const claims: RegistrationClaims = {
		model: input.descriptor.model,
		os_version: input.descriptor.osVersion,
		platform: input.descriptor.platform,
		secure_hardware: input.secureHardware,
		managed_configuration: input.managedConfiguration,
		iat: epochSeconds(issuedAt),
	}
	if (input.registrationSecret !== undefined) {
		claims.registration_secret = input.registrationSecret
	}
	if (input.groupCode !== undefined) {
		claims.group_code = input.groupCode
	}
	if (input.blockedPredecessorHwId !== undefined) {
		claims.blocked_predecessor_hw_id = input.blockedPredecessorHwId
	}
	return claims
}

export async function createRegistrationRequest(
	signer: JwsSigner,
	input: RegistrationInput,
	now: () => Date = () => new Date(),
): Promise<DeviceRegistrationRequest> {
	return { jws: await signBody(signer, registrationClaims(input, now())) }
}
