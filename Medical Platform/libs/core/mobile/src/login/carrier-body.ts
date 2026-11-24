import { epochSeconds, type JwsSigner, signBody } from "../device/device-proof"
import type { Challenge } from "./quick-login"

export interface ChallengeClaims {
	challenge_id: string
	value: string
	iat: number
}

export function challengeClaims(challenge: Challenge, now: Date): ChallengeClaims {
	return { challenge_id: challenge.challenge_id, value: challenge.value, iat: epochSeconds(now) }
}

export async function carrierBody(
	signer: Pick<JwsSigner, "signJws">,
	challenge: Challenge,
	identifier: string,
	now: () => Date = () => new Date(),
): Promise<string> {
	return await signBody(signer, { ...challengeClaims(challenge, now()), identifier })
}
