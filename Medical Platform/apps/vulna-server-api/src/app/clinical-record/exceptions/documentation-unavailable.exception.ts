import { ERROR_CODE } from "@ansora/contracts"
import { HttpStatus } from "@nestjs/common"
import { ProblemException } from "../../infra/exceptions/problem.exception"

// ADR-054 bod 5, CAP-020-R16
export class DocumentationUnavailableException extends ProblemException {
	constructor() {
		super(HttpStatus.SERVICE_UNAVAILABLE, ERROR_CODE.DOCUMENTATION_UNAVAILABLE)
	}
}
