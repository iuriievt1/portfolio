import "reflect-metadata"
import { ADMINISTRATION_SESSION_COOKIE } from "@ansora/contracts"
import type { Type } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import type { NestExpressApplication } from "@nestjs/platform-express"
import { SERVER_TEXTS } from "../../../i18n"
import type { LocalizationService } from "../../localization/localization.service"
import { ProblemJsonFilter } from "../filters/problem-json.filter"
import { applyApiPrefix } from "../hosting/api-prefix"

const PARAMETER_TYPES = "design:paramtypes"
const CONTENT_LANGUAGE = "cs"

export interface AdministrationHttp {
	request: (path: string, sessionToken: string, init?: RequestInit) => Promise<Response>
	close: () => Promise<void>
}

export function injects(target: Type<unknown>, dependencies: readonly Type<unknown>[]): void {
	Reflect.defineMetadata(PARAMETER_TYPES, dependencies, target)
}

export async function codeOf(response: Response): Promise<unknown> {
	const problem = (await response.json()) as { code?: unknown }
	return problem.code
}

export async function startAdministrationHttp(module: Type<unknown>): Promise<AdministrationHttp> {
	const app = await NestFactory.create<NestExpressApplication>(module, { logger: false })
	applyApiPrefix(app)
	const texts = { texts: SERVER_TEXTS.cs, contentLanguage: CONTENT_LANGUAGE }
	const localization = {
		responseTexts: async () => texts,
		administrationTexts: () => texts,
	} as unknown as LocalizationService
	app.useGlobalFilters(new ProblemJsonFilter(localization))
	await app.listen(0)
	const baseUrl = await app.getUrl()
	return {
		request: async (path, sessionToken, init = {}) =>
			await fetch(`${baseUrl}${path}`, {
				...init,
				headers: {
					cookie: `${ADMINISTRATION_SESSION_COOKIE}=${sessionToken}`,
					"content-type": "application/json",
					...init.headers,
				},
			}),
		close: async () => await app.close(),
	}
}
