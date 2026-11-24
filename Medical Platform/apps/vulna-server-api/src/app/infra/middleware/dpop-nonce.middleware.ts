import { API_BASE_PATH, DPOP_NONCE_HEADER } from "@ansora/contracts"
import { Injectable, type NestMiddleware, RequestMethod } from "@nestjs/common"
import type { NextFunction, Request, Response } from "express"
import { DpopNonceService } from "../../device/services/dpop-nonce.service"

const MOBILE_API_PREFIX = `${API_BASE_PATH}/`

export const EVERY_ROUTE = { path: "*path", method: RequestMethod.ALL }

// RFC 9449
@Injectable()
export class DpopNonceMiddleware implements NestMiddleware {
	constructor(private readonly nonces: DpopNonceService) {}

	use(request: Request, response: Response, next: NextFunction): void {
		if (request.originalUrl.startsWith(MOBILE_API_PREFIX)) {
			response.setHeader(DPOP_NONCE_HEADER, this.nonces.current())
		}
		next()
	}
}
