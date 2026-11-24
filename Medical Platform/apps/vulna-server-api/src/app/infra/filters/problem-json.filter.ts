import {
	ACCEPT_LANGUAGE_HEADER,
	ADMIN_API_BASE_PATH,
	CONTENT_LANGUAGE_HEADER,
	ERROR_CODE,
	type ProblemCode,
	type ProblemJson,
} from "@ansora/contracts"
import {
	type ArgumentsHost,
	Catch,
	type ExceptionFilter,
	HttpException,
	HttpStatus,
	Injectable,
	Logger,
} from "@nestjs/common"
import type { Request, Response } from "express"
import type { ServerTexts } from "../../../i18n"
import { LocalizationService, type ResponseTexts } from "../../localization/localization.service"
import { ProblemException } from "../exceptions/problem.exception"

// RFC 9457, ADR-012 ř. 52
function codeOf(exception: unknown, status: number): ProblemCode {
	if (exception instanceof ProblemException) {
		return exception.code
	}
	return status >= HttpStatus.INTERNAL_SERVER_ERROR ? ERROR_CODE.RETRY : ERROR_CODE.RECORD_REJECTED
}

function titleOf(texts: ServerTexts, code: ProblemCode, status: number, mobile: boolean): string {
	const title = mobile ? (texts.problems as Partial<Record<ProblemCode, string>>)[code] : undefined
	if (title !== undefined) {
		return title
	}
	return status >= HttpStatus.INTERNAL_SERVER_ERROR ? texts.problem.serverError : texts.problem.rejected
}

function isAdministration(request: Request): boolean {
	return request.path.startsWith(ADMIN_API_BASE_PATH)
}

@Catch()
@Injectable()
export class ProblemJsonFilter implements ExceptionFilter {
	private readonly logger = new Logger(ProblemJsonFilter.name)

	constructor(private readonly localization: LocalizationService) {}

	async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
		const context = host.switchToHttp()
		const response = context.getResponse<Response>()
		const request = context.getRequest<Request>()

		const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR
		if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
			// CAP-025-R18, NAB-479
			this.logger.error(`${request.method} ${request.path} failed with status ${status}`, exception)
		}

		const mobile = !isAdministration(request)
		const { texts, contentLanguage } = await this.textsOf(request, mobile)
		const code = codeOf(exception, status)
		const extensions = exception instanceof ProblemException ? exception.extensions : {}
		const body: ProblemJson = {
			...extensions,
			type: "about:blank",
			title: titleOf(texts, code, status, mobile),
			status,
			instance: request.url,
			code,
		}
		if (exception instanceof ProblemException) {
			if (exception.detail !== undefined) {
				body.detail = exception.detail
			}
			for (const [name, value] of Object.entries(exception.headers)) {
				response.setHeader(name, value)
			}
		}

		response.setHeader(CONTENT_LANGUAGE_HEADER, contentLanguage)
		response.status(status).type("application/problem+json").json(body)
	}

	// CAP-004-R13, CAP-015-R27
	private async textsOf(request: Request, mobile: boolean): Promise<ResponseTexts> {
		if (!mobile) {
			return this.localization.administrationTexts()
		}
		return await this.localization.responseTexts(request.get(ACCEPT_LANGUAGE_HEADER))
	}
}
