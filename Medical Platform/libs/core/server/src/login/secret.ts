import { createHash, randomBytes } from "node:crypto"

export const MILLISECONDS_PER_SECOND = 1000

const SECRET_BYTES = 32

export function randomSecret(): string {
	return randomBytes(SECRET_BYTES).toString("base64url")
}

export function sha256Hex(value: string | Uint8Array): string {
	return createHash("sha256").update(value).digest("hex")
}

export function sha256Base64url(value: string): string {
	return createHash("sha256").update(value).digest("base64url")
}

export function secondsAfter(start: Date, seconds: number): Date {
	return new Date(start.getTime() + seconds * MILLISECONDS_PER_SECOND)
}
