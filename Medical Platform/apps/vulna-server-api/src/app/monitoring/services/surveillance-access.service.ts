import { type SurveillanceAccess, surveillanceAccessOf, surveillanceTokenOf } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import type { Request } from "express"
import { EnvVariable } from "../../../libs/common/constants/env-variable.constants"
import { EnvVariableService } from "../../../libs/common/services/env-variable.service"
import { optionalPortOf } from "../../../libs/common/utils/optional-port"

// CAP-028-R08, CAP-028-S05, Q-058
@Injectable()
export class SurveillanceAccessService {
	private readonly token: string | undefined
	private readonly reservedPort: number | undefined

	constructor(env: EnvVariableService) {
		this.token = surveillanceTokenOf(env.getOptional(EnvVariable.SURVEILLANCE_TOKEN))
		this.reservedPort = optionalPortOf(env.getOptional(EnvVariable.PORT_API_SURVEILLANCE))
	}

	accessOf(request: Request): SurveillanceAccess {
		const isReservedInterface = this.reservedPort !== undefined && request.socket.localPort === this.reservedPort
		return surveillanceAccessOf({ authorization: request.headers.authorization, isReservedInterface }, this.token)
	}
}
