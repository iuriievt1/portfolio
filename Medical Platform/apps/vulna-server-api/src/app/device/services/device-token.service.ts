import { ERROR_CODE } from "@ansora/contracts"
import { accessTokenHash, CONFIGURATION_KEY, randomSecret, secondsAfter, sha256Hex } from "@ansora/core-server"
import { HttpStatus, Injectable } from "@nestjs/common"
import type { Request } from "express"
import { ConfigurationService } from "../../configuration/services/configuration.service"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { signInAgain } from "../../login/utils/login-rejection"
import { DeviceRepository } from "../repositories/device.repository"
import type { Device, DeviceToken } from "../types/device.types"
import { rejectionOfDeviceState } from "../utils/device-rejection"
import { DeviceProofService } from "./device-proof.service"

@Injectable()
export class DeviceTokenService {
	constructor(
		private readonly devices: DeviceRepository,
		private readonly configuration: ConfigurationService,
		private readonly proofs: DeviceProofService,
	) {}

	async issue(deviceId: string): Promise<DeviceToken> {
		const token = randomSecret()
		const lifetimeSeconds = await this.configuration.integer(CONFIGURATION_KEY.DEVICE_TOKEN_LIFETIME_SECONDS)
		const expiresAt = secondsAfter(new Date(), lifetimeSeconds)
		await this.devices.issueToken(deviceId, sha256Hex(token), expiresAt)
		return { token, expiresAt }
	}

	// CAP-002-R09
	private async deviceIdOf(token: string, now: Date): Promise<string | undefined> {
		return await this.devices.findTokenDeviceId(sha256Hex(token), now)
	}

	// CAP-002-R09, CAP-002-S31, CAP-002-S33, ADR-013
	async provenDeviceOf(request: Request, token: string, now: Date): Promise<Device> {
		const deviceId = await this.deviceIdOf(token, now)
		if (deviceId === undefined) {
			throw signInAgain()
		}
		const device = await this.proofs.ofApprovedDevice(request, accessTokenHash(token))
		if (device.id !== deviceId) {
			throw signInAgain()
		}
		return device
	}

	// CAP-002-R08, NAB-504, ADR-014
	async approvedDeviceOf(deviceId: string): Promise<Device> {
		const device = await this.devices.findById(deviceId)
		if (device === undefined) {
			throw new ProblemException(HttpStatus.UNAUTHORIZED, ERROR_CODE.DEVICE_UNKNOWN)
		}
		const rejection = rejectionOfDeviceState(device.state)
		if (rejection !== undefined) {
			throw rejection
		}
		return device
	}
}
