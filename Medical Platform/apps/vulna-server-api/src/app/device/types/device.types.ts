import type { MobileContract } from "@ansora/contracts"
import type {
	DevicePlatform,
	DeviceState,
	LoginMethodOverrides,
	PublicKeyJwk,
	SecureHardware,
} from "@ansora/core-server"

export type DeviceStateResponse = MobileContract.components["schemas"]["DeviceState"]

export type DeviceRegistrationInput = MobileContract.components["schemas"]["DeviceRegistrationRequest"]

export interface DeviceRow {
	id: string
	state: DeviceState
	public_key_jwk: PublicKeyJwk
	hw_id: string
	model: string
	os_version: string
	platform: DevicePlatform
	secure_hardware: SecureHardware
	managed_configuration: boolean
	group_code: string | null
	login_methods: LoginMethodOverrides
	blocked_predecessor_hw_id: string | null
}

export interface NewDevice {
	state: DeviceState
	publicKeyJwk: PublicKeyJwk
	hwId: string
	model: string
	osVersion: string
	platform: DevicePlatform
	secureHardware: SecureHardware
	managedConfiguration: boolean
	groupCode: string | null
	blockedPredecessorHwId: string | null
}

export interface Device {
	id: string
	state: DeviceState
	hwId: string
	publicKeyJwk: PublicKeyJwk
	groupCode: string | null
	loginMethods: LoginMethodOverrides
}

export interface DeviceToken {
	token: string
	expiresAt: Date
}

export interface VerifiedDevice {
	device: Device
	jti: string
}
