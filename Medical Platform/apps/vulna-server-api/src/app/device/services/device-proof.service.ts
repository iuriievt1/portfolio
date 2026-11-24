import { DPOP_HEADER, ERROR_CODE } from "@ansora/contracts"
import {
	CLOCK_SKEW_TOLERANCE_SECONDS,
	type DeviceProofExpectation,
	hardwareId,
	MILLISECONDS_PER_SECOND,
	type PublicKeyJwk,
	verifyDeviceProof,
} from "@ansora/core-server"
import { HttpStatus, Injectable } from "@nestjs/common"
import type { Request } from "express"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { DpopNonceRequiredException } from "../exceptions/dpop-nonce-required.exception"
import { DeviceRepository } from "../repositories/device.repository"
import type { Device } from "../types/device.types"
import { rejectionOfDeviceState } from "../utils/device-rejection"
import { DpopNonceService } from "./dpop-nonce.service"

export interface ProofOfNewDevice {
	jwk: PublicKeyJwk
	hwId: string
	jti: string
}

export interface ProofOfKnownDevice {
	device: Device
	jti: string
}

@Injectable()
export class DeviceProofService {
	constructor(
		private readonly devices: DeviceRepository,
		private readonly nonces: DpopNonceService,
	) {}

	signedHardwareId(request: Request): string | undefined {
		const proof = request.header(DPOP_HEADER)
		if (proof === undefined) {
			return undefined
		}
		const verdict = verifyDeviceProof(proof, expectationOf(request))
		return verdict.ok ? hardwareId(verdict.jwk) : undefined
	}

	ofNewDevice(request: Request): ProofOfNewDevice {
		const verdict = verifyDeviceProof(proofHeader(request), expectationOf(request))
		if (!verdict.ok) {
			throw unauthorized()
		}
		this.requireNonce(verdict.nonce)
		return { jwk: verdict.jwk, hwId: hardwareId(verdict.jwk), jti: verdict.jti }
	}

	async ofKnownDevice(request: Request, accessTokenHash?: string): Promise<ProofOfKnownDevice> {
		const claimed = verifyDeviceProof(proofHeader(request), expectationOf(request, accessTokenHash))
		if (!claimed.ok) {
			throw unauthorized()
		}
		this.requireNonce(claimed.nonce)
		const device = await this.devices.findByHwId(hardwareId(claimed.jwk))
		if (device === undefined) {
			throw new ProblemException(HttpStatus.UNAUTHORIZED, ERROR_CODE.DEVICE_UNKNOWN)
		}
		const verdict = verifyDeviceProof(proofHeader(request), {
			...expectationOf(request, accessTokenHash),
			knownKey: device.publicKeyJwk,
		})
		if (!verdict.ok) {
			throw unauthorized()
		}
		await this.consume(device.id, verdict.jti)
		return { device, jti: verdict.jti }
	}

	async ofApprovedDevice(request: Request, accessTokenHash?: string): Promise<Device> {
		const { device } = await this.ofKnownDevice(request, accessTokenHash)
		const rejection = rejectionOfDeviceState(device.state)
		if (rejection !== undefined) {
			throw rejection
		}
		return device
	}

	async consume(deviceId: string, jti: string): Promise<void> {
		await this.devices.forgetExpiredProofIdentifiers(toleranceStart())
		if (!(await this.devices.consumeProofIdentifier(deviceId, jti))) {
			throw unauthorized()
		}
	}

	// RFC 9449, Q-082
	private requireNonce(nonce: string | undefined): void {
		if (!this.nonces.accepts(nonce)) {
			throw new DpopNonceRequiredException(this.nonces.current())
		}
	}
}

function expectationOf(request: Request, accessTokenHash?: string): DeviceProofExpectation {
	const expectation: DeviceProofExpectation = { method: request.method, url: requestUrl(request), now: new Date() }
	if (accessTokenHash !== undefined) {
		expectation.accessTokenHash = accessTokenHash
	}
	return expectation
}

function proofHeader(request: Request): string {
	const proof = request.header(DPOP_HEADER)
	if (proof === undefined) {
		throw unauthorized()
	}
	return proof
}

function requestUrl(request: Request): string {
	return `${request.protocol}://${request.get("host") ?? ""}${request.originalUrl}`
}

function toleranceStart(): Date {
	return new Date(Date.now() - CLOCK_SKEW_TOLERANCE_SECONDS * MILLISECONDS_PER_SECOND)
}

function unauthorized(): ProblemException {
	return new ProblemException(HttpStatus.UNAUTHORIZED, ERROR_CODE.SIGN_IN_AGAIN)
}
