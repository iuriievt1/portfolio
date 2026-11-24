import { randomUUID } from "node:crypto"
import { randomSecret, secondsAfter, sha256Hex } from "./secret"

export const CHALLENGE_LIFETIME_SECONDS = 120

export interface IssuedChallenge {
	id: string
	value: string
	valueHash: string
	expiresAt: Date
}

export function issueChallenge(now: Date): IssuedChallenge {
	const value = randomSecret()
	return {
		id: randomUUID(),
		value,
		valueHash: sha256Hex(value),
		expiresAt: secondsAfter(now, CHALLENGE_LIFETIME_SECONDS),
	}
}
