import { databaseAnswers, HEALTH_PATH, HEALTH_STATUS, type HealthStatus } from "@ansora/core-server"
import { Controller, Get, HttpStatus, Res } from "@nestjs/common"
import type { Response } from "express"
import { DatabaseService } from "../../../libs/database/database.service"
import { OutsideMobileContract } from "../decorators/outside-mobile-contract.decorator"

// NAB-287, NAB-309, CAP-028-R06, CAP-028-R08, ADR-025
@OutsideMobileContract()
@Controller(HEALTH_PATH)
export class HealthController {
	constructor(private readonly database: DatabaseService) {}

	@Get("live")
	live(): { status: HealthStatus } {
		return { status: HEALTH_STATUS.OK }
	}

	// CAP-028-R07, CAP-028-R21, CAP-028-S04
	@Get("ready")
	async ready(@Res({ passthrough: true }) response: Response): Promise<{ status: HealthStatus }> {
		if (await databaseAnswers(this.database.sql)) {
			return { status: HEALTH_STATUS.OK }
		}
		response.status(HttpStatus.SERVICE_UNAVAILABLE)
		return { status: HEALTH_STATUS.UNAVAILABLE }
	}
}
