import { LOGIN_RETURN_PARAMETER, LOGIN_RETURN_URL } from "@ansora/contracts"

const TRAILING_SLASH = /\/$/

export interface LoginReturn {
	state: string
	completionCode: string
}

export function isLoginReturnUrl(url: string): boolean {
	return loginReturnUrlOf(url) !== undefined
}

export function parseLoginReturn(url: string): LoginReturn | undefined {
	const parsed = loginReturnUrlOf(url)
	if (parsed === undefined) {
		return undefined
	}
	const state = parsed.searchParams.get(LOGIN_RETURN_PARAMETER.STATE)
	const completionCode = parsed.searchParams.get(LOGIN_RETURN_PARAMETER.COMPLETION_CODE)
	if (state === null || state.length === 0 || completionCode === null || completionCode.length === 0) {
		return undefined
	}
	return { state, completionCode }
}

function loginReturnUrlOf(url: string): URL | undefined {
	let parsed: URL
	try {
		parsed = new URL(url)
	} catch {
		return undefined
	}
	if (`${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(TRAILING_SLASH, "") !== LOGIN_RETURN_URL) {
		return undefined
	}
	return parsed
}
