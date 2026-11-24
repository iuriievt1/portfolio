import {
	DEPENDENCIES_HEALTH_PATH,
	OPENMETRICS_CONTENT_TYPE,
	SURVEILLANCE_METRICS_PATH,
	surveillanceRefusalOf,
} from "@ansora/core-server"
import { Controller, Get, Req, Res } from "@nestjs/common"
import type { Request, Response } from "express"
import { OutsideMobileContract } from "../../infra/decorators/outside-mobile-contract.decorator"
import { SurveillanceService } from "../services/surveillance.service"
import { SurveillanceAccessService } from "../services/surveillance-access.service"

// CAP-028-R05, CAP-028-R08, CAP-028-R09, CAP-028-R10, ADR-025
@OutsideMobileContract()
@Controller()
export class SurveillanceController {
	constructor(
		private readonly access: SurveillanceAccessService,
		private readonly surveillance: SurveillanceService,
	) {}

	// CAP-028-R07, CAP-028-S02, CAP-028-S09
	@Get(DEPENDENCIES_HEALTH_PATH)
	async dependencies(@Req() request: Request, @Res() response: Response): Promise<void> {
		if (this.refused(request, response)) {
			return
		}
		response.json({ dependencies: await this.surveillance.dependencyStates() })
	}

	// CAP-028-S01
	@Get(SURVEILLANCE_METRICS_PATH)
	async metrics(@Req() request: Request, @Res() response: Response): Promise<void> {
		if (this.refused(request, response)) {
			return
		}
		response.type(OPENMETRICS_CONTENT_TYPE).send(await this.surveillance.metricsText(Date.now()))
	}

	// CAP-028-S05
	private refused(request: Request, response: Response): boolean {
		const refusal = surveillanceRefusalOf(this.access.accessOf(request))
		if (refusal === undefined) {
			return false
		}
		response.status(refusal.status).set(refusal.headers).end()
		return true
	}
}
