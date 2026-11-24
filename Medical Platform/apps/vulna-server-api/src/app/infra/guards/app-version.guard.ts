import { APP_VERSION_HEADER, DPOP_HEADER, ERROR_CODE } from "@ansora/contracts"
import { DEVICE_STATE, isAppVersionSupported, parseAppVersionHeader } from "@ansora/core-server"
import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import type { Request } from "express"
import { ConfigurationService } from "../../configuration/services/configuration.service"
import { DpopNonceRequiredException } from "../../device/exceptions/dpop-nonce-required.exception"
import { DeviceProofService } from "../../device/services/device-proof.service"
import { ACCEPTS_ANY_APP_VERSION } from "../decorators/accepts-any-app-version.decorator"
import { ACCEPTS_OUTDATED_APP_FOR_DRAFT } from "../decorators/accepts-outdated-app-for-draft.decorator"
import { OUTSIDE_MOBILE_CONTRACT } from "../decorators/outside-mobile-contract.decorator"
import { ProblemException } from "../exceptions/problem.exception"

@Injectable()
export class AppVersionGuard implements CanActivate {
	constructor(
		private readonly reflector: Reflector,
		private readonly configuration: ConfigurationService,
		private readonly proofs: DeviceProofService,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		if (this.isMarked(context, OUTSIDE_MOBILE_CONTRACT)) {
			return true
		}
		const request = context.switchToHttp().getRequest<Request>()
		const reported = parseAppVersionHeader(request.header(APP_VERSION_HEADER) ?? "")
		if (reported === undefined) {
			throw new ProblemException(HttpStatus.BAD_REQUEST, ERROR_CODE.RECORD_REJECTED)
		}
		if (this.isMarked(context, ACCEPTS_ANY_APP_VERSION)) {
			return true
		}
		const minimum = await this.configuration.minimumAppVersion()
		if (!isAppVersionSupported(reported, minimum)) {
			// CAP-012-R25
			if (this.isMarked(context, ACCEPTS_OUTDATED_APP_FOR_DRAFT)) {
				return true
			}
			await this.rejectRevokedDevice(request)
			throw new ProblemException(HttpStatus.FORBIDDEN, ERROR_CODE.APP_VERSION_UNSUPPORTED)
		}
		return true
	}

	// CAP-012-R24
	private async rejectRevokedDevice(request: Request): Promise<void> {
		if (request.header(DPOP_HEADER) === undefined) {
			return
		}
		const state = await this.proofs.ofKnownDevice(request).then(
			(proof) => proof.device.state,
			(error: unknown) => {
				if (error instanceof DpopNonceRequiredException) {
					throw error
				}
				return undefined
			},
		)
		if (state === DEVICE_STATE.REVOKED) {
			throw new ProblemException(HttpStatus.FORBIDDEN, ERROR_CODE.DEVICE_REVOKED)
		}
	}

	private isMarked(context: ExecutionContext, key: string): boolean {
		const marked = this.reflector.getAllAndOverride<boolean | undefined>(key, [
			context.getHandler(),
			context.getClass(),
		])
		return marked === true
	}
}
