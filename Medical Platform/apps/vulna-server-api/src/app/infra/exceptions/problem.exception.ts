import type { ProblemCode } from "@ansora/contracts"
import { HttpException, type HttpStatus } from "@nestjs/common"

export class ProblemException extends HttpException {
	constructor(
		status: HttpStatus,
		readonly code: ProblemCode,
		readonly detail?: string,
		readonly headers: Readonly<Record<string, string>> = {},
		readonly extensions: Readonly<Record<string, unknown>> = {},
	) {
		super(code, status)
	}
}
