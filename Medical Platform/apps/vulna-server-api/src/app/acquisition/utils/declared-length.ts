import type { Request } from "express"
import { CONTENT_LENGTH_HEADER } from "../constants/acquisition-file.constants"

const DECIMAL_RADIX = 10

// RFC 9110 Content-Length, CAP-015-R13
export function declaredLengthOf(request: Request): number | undefined {
	const header = request.headers[CONTENT_LENGTH_HEADER]
	if (header === undefined) {
		return undefined
	}
	const length = Number.parseInt(header, DECIMAL_RADIX)
	return Number.isSafeInteger(length) ? length : undefined
}
