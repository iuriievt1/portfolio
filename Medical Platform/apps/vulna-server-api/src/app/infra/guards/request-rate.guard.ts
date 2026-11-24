import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common"
import type { Request } from "express"
import { DeviceProofService } from "../../device/services/device-proof.service"
import { DeviceRequestLimitService } from "../../request-rate/services/device-request-limit.service"

@Injectable()
export class RequestRateGuard implements CanActivate {
	constructor(
		private readonly proofs: DeviceProofService,
		private readonly limits: DeviceRequestLimitService,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const deviceKey = this.proofs.signedHardwareId(context.switchToHttp().getRequest<Request>())
		if (deviceKey === undefined) {
			return true
		}
		await this.limits.count(deviceKey, new Date())
		return true
	}
}
