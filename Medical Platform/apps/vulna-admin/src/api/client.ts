import {
	ADMIN_API_BASE_PATH,
	ADMINISTRATION_ERROR_CODE,
	type AdministrationContract,
	BACKGROUND_REFRESH,
	BACKGROUND_REFRESH_HEADER,
} from "@ansora/contracts"
import { endSession } from "@/features/session/session-store"

// ADR-012, administrace-model-a-api.md 3
const BASE_URL = ADMIN_API_BASE_PATH
const NO_CONTENT = 204

export const LOGIN_URL = `${ADMIN_API_BASE_PATH}/login/oidc`

// CAP-004-R11, CAP-028-R14, administration.yaml BackgroundRefresh
export const BACKGROUND_REFRESH_INIT: RequestInit = { headers: { [BACKGROUND_REFRESH_HEADER]: BACKGROUND_REFRESH } }

type Problem = Readonly<Record<string, unknown>>

type ErrorBody = AdministrationContract.components["schemas"]["Error"]

export class AdministrationApiError extends Error {
	constructor(
		readonly status: number,
		readonly code: string | undefined,
		readonly problem: Problem = {},
	) {
		super(`The API returned ${status}: ${code ?? "unknown error"}`)
		this.name = "AdministrationApiError"
	}
}

export function withQuery(path: string, query: Readonly<Record<string, string | undefined>>): string {
	const parameters = new URLSearchParams()
	for (const [name, value] of Object.entries(query)) {
		if (value !== undefined) {
			parameters.set(name, value)
		}
	}
	const text = parameters.toString()
	return text === "" ? path : `${path}?${text}`
}

export async function callApi<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(`${BASE_URL}${path}`, {
		...init,
		credentials: "include",
		headers: { "content-type": "application/json", ...init?.headers },
	})
	if (!response.ok) {
		const problem = await problemOf(response)
		const code = typeof problem.code === "string" ? problem.code : undefined
		if (code === ADMINISTRATION_ERROR_CODE.REAUTHENTICATION_REQUIRED) {
			endSession()
		}
		throw new AdministrationApiError(response.status, code, problem)
	}
	if (response.status === NO_CONTENT) {
		return undefined as T
	}
	return (await response.json()) as T
}

// RFC 9457
async function problemOf(response: Response): Promise<Problem> {
	try {
		const problem: unknown = await response.json()
		return typeof problem === "object" && problem !== null ? (problem as Problem) : {}
	} catch {
		return {}
	}
}

// administration.yaml Error.missing_names, Error.rejected_rows
export function problemMemberOf(error: unknown, member: keyof ErrorBody): unknown {
	return error instanceof AdministrationApiError ? error.problem[member] : undefined
}

export function errorCodeOf(error: unknown): string | undefined {
	return error instanceof AdministrationApiError ? error.code : undefined
}
