import { describe, expect, it } from "vitest"
import { ChallengeReserve, RESERVE_MAX_AGE_MILLISECONDS } from "../challenge-reserve"
import type { Challenge, ChallengeApi } from "../quick-login"

interface Fake {
	api: ChallengeApi
	issued: number
	fail: boolean
}

function fakeApi(): Fake {
	const fake: Fake = { issued: 0, fail: false, api: undefined as unknown as ChallengeApi }
	fake.api = {
		async issueChallenge(): Promise<Challenge> {
			fake.issued += 1
			if (fake.fail) {
				throw new Error("offline")
			}
			return { challenge_id: `c${fake.issued}`, value: "v", expires_at: "2026-10-08T10:02:00.000Z" }
		},
	}
	return fake
}

function clock(start = 0) {
	let now = start
	return { now: () => now, advance: (milliseconds: number) => (now += milliseconds) }
}

describe("challenge reserved while the PIN is typed CAP-001-R24", () => {
	it("hands the challenge requested ahead to the confirmation without asking again", async () => {
		const fake = fakeApi()
		const reserve = new ChallengeReserve(fake.api, clock().now)

		reserve.prepare()
		reserve.prepare()
		const challenge = await reserve.issueChallenge()

		expect(challenge.challenge_id).toBe("c1")
		expect(fake.issued).toBe(1)
	})

	it("never hands one challenge out twice", async () => {
		const fake = fakeApi()
		const reserve = new ChallengeReserve(fake.api, clock().now)

		reserve.prepare()
		await reserve.issueChallenge()
		const second = await reserve.issueChallenge()

		expect(second.challenge_id).toBe("c2")
	})

	it("asks for a new challenge when the reserved one has grown old", async () => {
		const fake = fakeApi()
		const time = clock()
		const reserve = new ChallengeReserve(fake.api, time.now)

		reserve.prepare()
		time.advance(RESERVE_MAX_AGE_MILLISECONDS)
		const challenge = await reserve.issueChallenge()

		expect(challenge.challenge_id).toBe("c2")
	})

	it("replaces an old reserve when the typing goes on", async () => {
		const fake = fakeApi()
		const time = clock()
		const reserve = new ChallengeReserve(fake.api, time.now)

		reserve.prepare()
		time.advance(RESERVE_MAX_AGE_MILLISECONDS)
		reserve.prepare()
		const challenge = await reserve.issueChallenge()

		expect(challenge.challenge_id).toBe("c2")
		expect(fake.issued).toBe(2)
	})

	it("asks again on confirmation when the request ahead failed, so the real failure is reported", async () => {
		const fake = fakeApi()
		const reserve = new ChallengeReserve(fake.api, clock().now)

		fake.fail = true
		reserve.prepare()
		await expect(reserve.issueChallenge()).rejects.toThrow("offline")

		expect(fake.issued).toBe(2)
	})

	it("asks once on confirmation when nothing was reserved", async () => {
		const fake = fakeApi()
		const reserve = new ChallengeReserve(fake.api, clock().now)

		const challenge = await reserve.issueChallenge()

		expect(challenge.challenge_id).toBe("c1")
		expect(fake.issued).toBe(1)
	})
})
