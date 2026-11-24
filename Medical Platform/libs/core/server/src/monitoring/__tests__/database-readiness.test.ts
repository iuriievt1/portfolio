import type postgres from "@veevoy/postgres"
import { describe, expect, it } from "vitest"
import { answeredWithin, databaseAnswers } from "../database-readiness"

const TIMEOUT_MILLISECONDS = 20

function databaseThat(answer: () => Promise<unknown>): postgres.Sql {
	return (() => answer()) as unknown as postgres.Sql
}

describe("databaseAnswers", () => {
	it("CAP-028-R06 is ready when the database answers", async () => {
		expect(
			await databaseAnswers(
				databaseThat(async () => [{ "?column?": 1 }]),
				TIMEOUT_MILLISECONDS,
			),
		).toBe(true)
	})

	it("CAP-028-S04 is not ready when the database refuses the connection", async () => {
		const refused = databaseThat(async () => Promise.reject(new Error("connect ECONNREFUSED")))

		expect(await databaseAnswers(refused, TIMEOUT_MILLISECONDS)).toBe(false)
	})

	it("CAP-028-R21 is not ready when the database does not answer in time", async () => {
		const silent = databaseThat(() => new Promise(() => {}))

		expect(await databaseAnswers(silent, TIMEOUT_MILLISECONDS)).toBe(false)
	})
})

describe("answeredWithin", () => {
	it("CAP-028-R21 hands over the answer that came in time", async () => {
		expect(await answeredWithin(Promise.resolve(7), TIMEOUT_MILLISECONDS)).toBe(7)
	})

	it("CAP-028-R21 gives up on work that failed or did not finish in time", async () => {
		expect(await answeredWithin(Promise.reject(new Error("lock timeout")), TIMEOUT_MILLISECONDS)).toBeUndefined()
		expect(await answeredWithin(new Promise(() => {}), TIMEOUT_MILLISECONDS)).toBeUndefined()
	})
})
