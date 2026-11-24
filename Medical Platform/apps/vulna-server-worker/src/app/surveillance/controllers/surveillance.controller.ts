import {
	DEPENDENCIES_HEALTH_PATH,
	HEALTH_PATH,
	HEALTH_STATUS,
	type HealthStatus,
	OPENMETRICS_CONTENT_TYPE,
	SURVEILLANCE_METRICS_PATH,
	surveillanceRefusalOf,
} from "@ansora/core-server"
import { Controller, Get, HttpStatus, Req, Res } from "@nestjs/common"
import type { Request, Response } from "express"
import { SurveillanceService } from "../services/surveillance.service"

// NAB-287, NAB-309, CAP-028-R06, CAP-028-R08, ADR-025, provoz-a-dohled.md 7.2
@Controller()
export class SurveillanceController {
	constructor(private readonly surveillance: SurveillanceService) {}

	@Get(`${HEALTH_PATH}/live`)
	live(): { status: HealthStatus } {
		return { status: HEALTH_STATUS.OK }
	}

	// CAP-028-R07, CAP-028-R21, CAP-028-S02
	@Get(`${HEALTH_PATH}/ready`)
	async ready(@Res({ passthrough: true }) response: Response): Promise<{ status: HealthStatus }> {
		if (await this.surveillance.isReady()) {
			return { status: HEALTH_STATUS.OK }
		}
		response.status(HttpStatus.SERVICE_UNAVAILABLE)
		return { status: HEALTH_STATUS.UNAVAILABLE }
	}

	@Get(DEPENDENCIES_HEALTH_PATH)
	async dependencies(@Req() request: Request, @Res() response: Response): Promise<void> {
		if (this.refused(request, response)) {
			return
		}
		response.json({ dependencies: await this.surveillance.dependencyStates() })
	}

	@Get(SURVEILLANCE_METRICS_PATH)
	async metrics(@Req() request: Request, @Res() response: Response): Promise<void> {
		if (this.refused(request, response)) {
			return
		}
		response.type(OPENMETRICS_CONTENT_TYPE).send(await this.surveillance.metricsText())
	}

	// CAP-028-S05
	private refused(request: Request, response: Response): boolean {
		const refusal = surveillanceRefusalOf(this.surveillance.accessOf(request.headers.authorization))
		if (refusal === undefined) {
			return false
		}
		response.status(refusal.status).set(refusal.headers).end()
		return true
	}
}
