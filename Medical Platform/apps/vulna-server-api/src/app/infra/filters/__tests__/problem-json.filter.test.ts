import {
	ACCEPT_LANGUAGE_HEADER,
	ADMIN_API_BASE_PATH,
	ADMINISTRATION_ERROR_CODE,
	API_BASE_PATH,
	CONTENT_LANGUAGE_HEADER,
	ERROR_CODE,
} from "@ansora/contracts"
import { CONFIGURATION_KEY } from "@ansora/core-server"
import { type ArgumentsHost, HttpStatus } from "@nestjs/common"
import { describe, expect, it } from "vitest"
import { cs } from "../../../../i18n/cs"
import { en } from "../../../../i18n/en"
import type { ProfileService } from "../../../../libs/profile/profile.service"
import type { ConfigurationService } from "../../../configuration/services/configuration.service"
import { LocalizationService } from "../../../localization/localization.service"
import { ProblemException } from "../../exceptions/problem.exception"
import { ProblemJsonFilter } from "../problem-json.filter"

const PIN_LOGIN_PATH = `${API_BASE_PATH}/login/pin`

interface Answer {
	status: number
	headers: Record<string, string>
	body: { title?: string; code?: string }
}

const PROFILE = {
	configurationSchema: { properties: { localization: { properties: { default_language: { default: "cs" } } } } },
} as unknown as ProfileService

const CONFIGURATION = {
	values: async () =>
		new Map<string, unknown>([
			[CONFIGURATION_KEY.DEFAULT_LANGUAGE, "cs"],
			[CONFIGURATION_KEY.SUPPORTED_LANGUAGES, ["cs", "en"]],
		]),
} as unknown as ConfigurationService

async function answerTo(path: string, acceptLanguage: string, exception: unknown): Promise<Answer> {
	const answer: Answer = { status: 0, headers: {}, body: {} }
	const response = {
		setHeader: (name: string, value: string) => {
			answer.headers[name] = value
		},
		status(status: number) {
			answer.status = status
			return this
		},
		type() {
			return this
		},
		json(body: Answer["body"]) {
			answer.body = body
		},
	}
	const request = {
		method: "GET",
		url: path,
		path,
		get: (name: string) => (name === ACCEPT_LANGUAGE_HEADER ? acceptLanguage : undefined),
	}
	const host = {
		switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
	} as unknown as ArgumentsHost
	await new ProblemJsonFilter(new LocalizationService(CONFIGURATION, PROFILE)).catch(exception, host)
	return answer
}

describe("ProblemJsonFilter", () => {
	it("CAP-004-S09 answers the administration in Czech whatever language the browser asks for", async () => {
		const answer = await answerTo(
			`${ADMIN_API_BASE_PATH}/users`,
			"en",
			new ProblemException(HttpStatus.NOT_FOUND, ADMINISTRATION_ERROR_CODE.NOT_FOUND),
		)
		expect(answer.headers[CONTENT_LANGUAGE_HEADER]).toBe("cs")
		expect(answer.body.title).toBe(cs.problem.rejected)
	})

	it("CAP-015-S32 answers the mobile app in the language it asks for, with the same stable code", async () => {
		const exception = new ProblemException(HttpStatus.UNAUTHORIZED, ERROR_CODE.LOGIN_FAILED)
		const english = await answerTo(PIN_LOGIN_PATH, "en", exception)
		const czech = await answerTo(PIN_LOGIN_PATH, "cs", exception)
		expect(english.headers[CONTENT_LANGUAGE_HEADER]).toBe("en")
		expect(english.body.title).toBe(en.problems[ERROR_CODE.LOGIN_FAILED])
		expect(english.body.code).toBe(czech.body.code)
	})
})
