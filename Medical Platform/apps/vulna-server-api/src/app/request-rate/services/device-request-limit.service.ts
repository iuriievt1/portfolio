import { ERROR_CODE, RETRY_AFTER_HEADER } from "@ansora/contracts"
import { CONFIGURATION_KEY } from "@ansora/core-server"
import { HttpStatus, Injectable } from "@nestjs/common"
import { ConfigurationService } from "../../configuration/services/configuration.service"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { RequestRateService } from "./request-rate.service"

// api/README.md 7, CAP-019-R13
@Injectable()
export class DeviceRequestLimitService {
	constructor(
		private readonly configuration: ConfigurationService,
		private readonly rates: RequestRateService,
	) {}

	async count(deviceKey: string, now: Date): Promise<void> {
		const limit = await this.configuration.integer(CONFIGURATION_KEY.API_MAX_REQUESTS_PER_MINUTE_PER_DEVICE)
		const verdict = this.rates.take(deviceKey, limit, now)
		if (verdict.allowed) {
			return
		}
		throw new ProblemException(HttpStatus.TOO_MANY_REQUESTS, ERROR_CODE.RETRY, undefined, {
			[RETRY_AFTER_HEADER]: String(verdict.retryAfterSeconds),
		})
	}
}
