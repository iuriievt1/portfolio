import { Injectable, type NestMiddleware } from "@nestjs/common"
import type { NextFunction, Request, Response } from "express"
import { normalizedAddress, runInRequestContext } from "../request-context/request-context"

// CAP-025-R04
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
	use(request: Request, _response: Response, next: NextFunction): void {
		runInRequestContext({ sourceAddress: normalizedAddress(request.ip) }, next)
	}
}
