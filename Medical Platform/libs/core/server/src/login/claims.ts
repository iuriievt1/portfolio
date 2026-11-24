import { EMAIL_MAX_LENGTH, LOGIN_NAME_MAX_LENGTH } from "@ansora/contracts"
import { boundedText } from "../text"

export function claimTextOf(
	claims: Readonly<Record<string, unknown>>,
	claimName: string,
	maxLength: number,
): string | undefined {
	const value = claims[claimName]
	const text = typeof value === "number" && Number.isInteger(value) ? String(value) : value
	return typeof text === "string" ? boundedText(text, maxLength) : undefined
}

// administration.yaml User login_name
export function loginNameOf(claims: Readonly<Record<string, unknown>>, claimName: string): string | undefined {
	return claimTextOf(claims, claimName, LOGIN_NAME_MAX_LENGTH)
}

// administration.yaml User email
export function emailOf(claims: Readonly<Record<string, unknown>>, claimName: string): string | undefined {
	return claimTextOf(claims, claimName, EMAIL_MAX_LENGTH)
}
