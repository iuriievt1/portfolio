export class CodedError extends Error {
	constructor(
		readonly code: string,
		readonly retryAfterSeconds?: number,
	) {
		super(code)
	}
}

export function codeOf(error: unknown): string | undefined {
	return error instanceof CodedError ? error.code : undefined
}

export function retryAfterOf(error: unknown): number | undefined {
	return error instanceof CodedError ? error.retryAfterSeconds : undefined
}

export function isNoConnection(error: unknown): boolean {
	return error instanceof TypeError
}
