import { RETRY_AFTER_HEADER } from "@ansora/contracts"

// RFC 9457, ADR-012
interface Problem {
	code?: string
	missing_steps?: string[]
}

const MILLISECONDS_PER_SECOND = 1000

export function errorCodeOf(error: unknown): string | undefined {
	const code = (error as { code?: unknown } | null)?.code
	return typeof code === "string" ? code : undefined
}

// RFC 9457, ADR-012
export class ApiProblemError extends Error {
	constructor(
		readonly status: number,
		readonly code: string | undefined,
		readonly retryAfterSeconds: number | undefined = undefined,
		readonly missingSteps: readonly string[] | undefined = undefined,
	) {
		super(`The API returned ${status}: ${code ?? "unknown error"}`)
		this.name = "ApiProblemError"
	}

	static async from(response: Response): Promise<ApiProblemError> {
		const problem = await problemOf(response)
		return new ApiProblemError(response.status, problem.code, retryAfter(response), problem.missing_steps)
	}
}

// CAP-002-R17, CAP-019-R29
export class NoConnectionError extends Error {
	constructor(cause: unknown) {
		super("The request did not reach the server", { cause })
		this.name = "NoConnectionError"
	}
}

// CAP-002-R17
export function isNoConnection(error: unknown): boolean {
	return error instanceof NoConnectionError
}

// RFC 9110, CAP-019-R18
export function retryAfterMsOf(error: ApiProblemError): number | undefined {
	return error.retryAfterSeconds === undefined ? undefined : error.retryAfterSeconds * MILLISECONDS_PER_SECOND
}

function retryAfter(response: Response): number | undefined {
	const header = response.headers.get(RETRY_AFTER_HEADER)
	if (header === null) {
		return undefined
	}
	const seconds = Number(header)
	return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined
}

// CAP-019-R27
async function problemOf(response: Response): Promise<Problem> {
	try {
		const problem = (await response.json()) as { code?: unknown; missing_steps?: unknown }
		return {
			code: typeof problem.code === "string" ? problem.code : undefined,
			missing_steps: textsOf(problem.missing_steps),
		}
	} catch {
		return {}
	}
}

function textsOf(value: unknown): string[] | undefined {
	return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : undefined
}
