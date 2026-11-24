import type { Challenge, ChallengeApi } from "./quick-login"

export const RESERVE_MAX_AGE_MILLISECONDS = 30_000

interface ReservedChallenge {
	challenge: Promise<Challenge>
	requestedAt: number
}

// CAP-001-R24, CAP-001-R07
export class ChallengeReserve implements ChallengeApi {
	private reserved: ReservedChallenge | undefined

	constructor(
		private readonly api: ChallengeApi,
		private readonly now: () => number = Date.now,
	) {}

	prepare(): void {
		if (this.reserved !== undefined && this.isFresh(this.reserved)) {
			return
		}
		const reserved = { challenge: this.api.issueChallenge(), requestedAt: this.now() }
		this.reserved = reserved
		reserved.challenge.catch(() => this.drop(reserved))
	}

	async issueChallenge(): Promise<Challenge> {
		const reserved = this.reserved
		this.reserved = undefined
		if (reserved === undefined || !this.isFresh(reserved)) {
			return await this.api.issueChallenge()
		}
		try {
			return await reserved.challenge
		} catch {
			return await this.api.issueChallenge()
		}
	}

	private isFresh(reserved: ReservedChallenge): boolean {
		return this.now() - reserved.requestedAt < RESERVE_MAX_AGE_MILLISECONDS
	}

	private drop(reserved: ReservedChallenge): void {
		if (this.reserved === reserved) {
			this.reserved = undefined
		}
	}
}
