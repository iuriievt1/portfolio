import { describe, expect, it } from "vitest"
import { parseDatabaseUpdatedAt } from "../vulnerabilities"

describe("B9 vulnerability database age", () => {
	it("reads the update time of the database", () => {
		const json = '{"Version":"0.74.0","VulnerabilityDB":{"Version":2,"UpdatedAt":"2026-09-17T07:06:17Z"}}'
		expect(parseDatabaseUpdatedAt(json)).toBe("2026-09-17T07:06:17Z")
	})

	it("fails when the database is not available", () => {
		expect(() => parseDatabaseUpdatedAt('{"Version":"0.74.0"}')).toThrow("vulnerability database not available")
	})
})
