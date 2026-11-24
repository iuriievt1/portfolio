import { ERROR_CODE } from "@ansora/contracts"
import {
	AUDIT_ACTOR_KIND,
	AUDIT_EVENT_TYPE,
	AUDIT_OUTCOME,
	DEVICE_STATE,
	registrationGroupCode,
	registrationState,
	verifyRegistrationBody,
} from "@ansora/core-server"
import { HttpStatus, Injectable } from "@nestjs/common"
import type { Request } from "express"
import { EnvVariable } from "../../../libs/common/constants/env-variable.constants"
import { EnvVariableService } from "../../../libs/common/services/env-variable.service"
import { DatabaseService } from "../../../libs/database/database.service"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import { EffectiveConfigurationService } from "../../effective-configuration/services/effective-configuration.service"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { DeviceRepository } from "../repositories/device.repository"
import { DeviceGroupRepository } from "../repositories/device-group.repository"
import type { Device, DeviceRegistrationInput, DeviceStateResponse } from "../types/device.types"
import { rejectionOfDeviceState } from "../utils/device-rejection"
import { DeviceProofService } from "./device-proof.service"
import { DeviceTokenService } from "./device-token.service"

@Injectable()
export class DeviceService {
	constructor(
		private readonly database: DatabaseService,
		private readonly devices: DeviceRepository,
		private readonly deviceGroups: DeviceGroupRepository,
		private readonly proofs: DeviceProofService,
		private readonly tokens: DeviceTokenService,
		private readonly audit: AuditRepository,
		private readonly env: EnvVariableService,
		private readonly effectiveConfiguration: EffectiveConfigurationService,
	) {}

	async register(request: Request, input: DeviceRegistrationInput): Promise<DeviceStateResponse> {
		const proof = this.proofs.ofNewDevice(request)
		const verdict = verifyRegistrationBody(input.jws, proof.jwk, new Date())
		if (!verdict.ok) {
			await this.auditRejectedRegistration(proof.hwId, verdict.reason)
			throw new ProblemException(HttpStatus.BAD_REQUEST, ERROR_CODE.RECORD_REJECTED)
		}
		const known = await this.devices.findByHwId(proof.hwId)
		if (known !== undefined) {
			await this.proofs.consume(known.id, proof.jti)
			return await this.stateOf(known)
		}
		const secret = this.env.getOptional(EnvVariable.DEVICE_REGISTRATION_SECRET)
		const { claims } = verdict
		const groupCode = await this.knownGroup(registrationGroupCode(claims, secret))
		const device = await this.database.sql.begin(async (tx) => {
			const registered = await this.devices.insert(tx, {
				state: registrationState(claims, secret),
				publicKeyJwk: proof.jwk,
				hwId: proof.hwId,
				model: claims.model,
				osVersion: claims.osVersion,
				platform: claims.platform,
				secureHardware: claims.secureHardware,
				managedConfiguration: claims.managedConfiguration,
				groupCode,
				blockedPredecessorHwId: claims.blockedPredecessorHwId ?? null,
			})
			await this.audit.append(tx, {
				eventType: AUDIT_EVENT_TYPE.DEVICE_REGISTRATION,
				actorKind: AUDIT_ACTOR_KIND.DEVICE,
				actorDeviceId: registered.id,
				objectId: registered.id,
				outcome: AUDIT_OUTCOME.SUCCESS,
				details: {
					hw_id: registered.hwId,
					state: registered.state,
					platform: claims.platform,
					secure_hardware: claims.secureHardware,
					managed_configuration: claims.managedConfiguration,
					group_code: registered.groupCode,
					blocked_predecessor_hw_id: claims.blockedPredecessorHwId ?? null,
				},
			})
			return registered
		})
		await this.proofs.consume(device.id, proof.jti)
		return await this.stateOf(device)
	}

	async verify(request: Request): Promise<DeviceStateResponse> {
		const { device } = await this.proofs.ofKnownDevice(request)
		return await this.stateOf(device)
	}

	private async knownGroup(code: string | null): Promise<string | null> {
		if (code === null || !(await this.deviceGroups.exists(code))) {
			return null
		}
		return code
	}

	private async stateOf(device: Device): Promise<DeviceStateResponse> {
		const pending = device.state === DEVICE_STATE.PENDING_APPROVAL
		const rejection = pending ? undefined : rejectionOfDeviceState(device.state)
		if (rejection !== undefined) {
			throw rejection
		}
		const configuration = await this.effectiveConfiguration.forDevice(device)
		const allowed = configuration.allowed_login_methods ?? []
		if (pending) {
			return { state: DEVICE_STATE.PENDING_APPROVAL, hw_id: device.hwId, allowed_login_methods: allowed }
		}
		const token = await this.tokens.issue(device.id)
		return {
			state: DEVICE_STATE.APPROVED,
			hw_id: device.hwId,
			allowed_login_methods: allowed,
			device_token: token.token,
			device_token_expires_at: token.expiresAt.toISOString(),
			effective_configuration: configuration,
		}
	}

	private async auditRejectedRegistration(hwId: string, reason: string): Promise<void> {
		await this.database.sql.begin(async (tx) => {
			await this.audit.append(tx, {
				eventType: AUDIT_EVENT_TYPE.DEVICE_REGISTRATION,
				actorKind: AUDIT_ACTOR_KIND.DEVICE,
				outcome: AUDIT_OUTCOME.FAILURE,
				details: { hw_id: hwId, reason },
			})
		})
	}
}
