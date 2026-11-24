import { randomBytes } from "node:crypto"
import { USE_DPOP_NONCE_ERROR } from "@ansora/contracts"
import { MILLISECONDS_PER_SECOND } from "../login/secret"

export const DPOP_NONCE_ROTATION_SECONDS = 300
const DPOP_NONCE_BYTES = 16
const ROTATION_MILLISECONDS = DPOP_NONCE_ROTATION_SECONDS * MILLISECONDS_PER_SECOND

// RFC 9449
export const USE_DPOP_NONCE_CHALLENGE = `DPoP error="${USE_DPOP_NONCE_ERROR}", error_description="Resource server requires nonce in DPoP proof"`

export function randomDpopNonce(): string {
	return randomBytes(DPOP_NONCE_BYTES).toString("base64url")
}

// Q-082
export class DpopNonceRing {
	private current: string
	private previous: string | undefined
	private periodStart: number

	constructor(
		now: Date,
		private readonly newNonce: () => string = randomDpopNonce,
	) {
		this.current = newNonce()
		this.periodStart = now.getTime()
	}

	currentNonce(now: Date): string {
		this.rotateIfDue(now)
		return this.current
	}

	accepts(nonce: string | undefined, now: Date): boolean {
		this.rotateIfDue(now)
		return nonce !== undefined && (nonce === this.current || nonce === this.previous)
	}

	private rotateIfDue(now: Date): void {
		const elapsedPeriods = Math.floor((now.getTime() - this.periodStart) / ROTATION_MILLISECONDS)
		if (elapsedPeriods < 1) {
			return
		}
		this.previous = elapsedPeriods === 1 ? this.current : undefined
		this.current = this.newNonce()
		this.periodStart += elapsedPeriods * ROTATION_MILLISECONDS
	}
}
