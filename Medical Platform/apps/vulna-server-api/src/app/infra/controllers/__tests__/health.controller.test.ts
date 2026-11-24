import type postgres from "@veevoy/postgres"
import type { Response } from "express"
import { describe, expect, it } from "vitest"
import type { DatabaseService } from "../../../../libs/database/database.service"
import { HealthController } from "../health.controller"

function controllerWith(isDatabaseUp: boolean): HealthController {
	const sql = (() =>
		isDatabaseUp ? Promise.resolve([]) : Promise.reject(new Error("ECONNREFUSED"))) as unknown as postgres.Sql
	return new HealthController({ sql } as unknown as DatabaseService)
}

function responseRecorder() {
	const statuses: number[] = []
	return { response: { status: (status: number) => statuses.push(status) } as unknown as Response, statuses }
}

describe("HealthController", () => {
	it("CAP-028-R06 is live without asking anything", () => {
		expect(controllerWith(false).live()).toEqual({ status: "ok" })
	})

	it("CAP-028-R06 is ready while the database answers", async () => {
		const { response, statuses } = responseRecorder()

		expect(await controllerWith(true).ready(response)).toEqual({ status: "ok" })
		expect(statuses).toEqual([])
	})

	it("CAP-028-S04 is live but not ready without the database, with a bare result", async () => {
		const { response, statuses } = responseRecorder()

		expect(await controllerWith(false).ready(response)).toEqual({ status: "unavailable" })
		expect(statuses).toEqual([503])
	})
})
