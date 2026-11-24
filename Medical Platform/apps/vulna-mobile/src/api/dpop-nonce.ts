import { DPOP_NONCE_HEADER, USE_DPOP_NONCE_ERROR, WWW_AUTHENTICATE_HEADER } from "@ansora/contracts"
import { HTTP_STATUS } from "./http-status"

const USE_DPOP_NONCE_PARAMETER = `error="${USE_DPOP_NONCE_ERROR}"`

interface ServerAnswer {
	status: number
	headers: Pick<Headers, "get">
}

// RFC 9449
let newestNonce: string | undefined

export function latestNonce(): string | undefined {
	return newestNonce
}

export function rememberNonce(answer: ServerAnswer): void {
	const nonce = answer.headers.get(DPOP_NONCE_HEADER)
	if (nonce !== null && nonce !== "") {
		newestNonce = nonce
	}
}

export function isNonceRequired(answer: ServerAnswer): boolean {
	const challenge = answer.headers.get(WWW_AUTHENTICATE_HEADER) ?? ""
	return answer.status === HTTP_STATUS.UNAUTHORIZED && challenge.includes(USE_DPOP_NONCE_PARAMETER)
}
