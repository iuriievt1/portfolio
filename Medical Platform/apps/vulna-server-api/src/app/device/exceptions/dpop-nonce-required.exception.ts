import { DPOP_NONCE_HEADER, ERROR_CODE, WWW_AUTHENTICATE_HEADER } from "@ansora/contracts"
import { USE_DPOP_NONCE_CHALLENGE } from "@ansora/core-server"
import { HttpStatus } from "@nestjs/common"
import { ProblemException } from "../../infra/exceptions/problem.exception"

export class DpopNonceRequiredException extends ProblemException {
	constructor(nonce: string) {
		super(HttpStatus.UNAUTHORIZED, ERROR_CODE.RETRY, undefined, {
			[WWW_AUTHENTICATE_HEADER]: USE_DPOP_NONCE_CHALLENGE,
			[DPOP_NONCE_HEADER]: nonce,
		})
	}
}
