import { DEPENDENCY_STATE, type DependencyState } from "@ansora/contracts"
import { SURVEILLANCE_ACCESS } from "@ansora/core-server"
import type postgres from "@veevoy/postgres"
import type { Request, Response } from "express"
import { describe, expect, it } from "vitest"
import type { EnvVariableService } from "../../../libs/common/services/env-variable.service"
import type { DatabaseService } from "../../../libs/database/database.service"
import { DependencyStateService } from "../../../libs/dependency-state/dependency-state.service"
import type { DurableBinaryStoreService } from "../../clinical-record-upload/services/durable-binary-store.service"
import { SurveillanceController } from "../controllers/surveillance.controller"
import { SurveillanceService } from "../services/surveillance.service"

const TOKEN = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6"

interface Options {
	isDatabaseUp: boolean
	isStoreConfigured: boolean
	token: string | undefined
}

function harness(options: Options) {
	const dependencies = new DependencyStateService()
	const sql = (() =>
		options.isDatabaseUp ? Promise.resolve([]) : Promise.reject(new Error("ECONNREFUSED"))) as unknown as postgres.Sql
	const env = { getOptional: () => options.token } as unknown as EnvVariableService
	const stores = {
		current: async () => (options.isStoreConfigured ? {} : undefined),
	} as unknown as DurableBinaryStoreService
	const service = new SurveillanceService(env, { sql } as unknown as DatabaseService, dependencies, stores)
	return { service, controller: new SurveillanceController(service), dependencies }
}

function recorder() {
	const sent: { status: number | undefined; headers: unknown; body: unknown; type: string | undefined } = {
		status: undefined,
		headers: undefined,
		body: undefined,
		type: undefined,
	}
	const response = {
		status(status: number) {
			sent.status = status
			return response
		},
		set(headers: unknown) {
			sent.headers = headers
			return response
		},
		type(type: string) {
			sent.type = type
			return response
		},
		json(body: unknown) {
			sent.body = body
		},
		send(body: unknown) {
			sent.body = body
		},
		end() {},
	} as unknown as Response
	return { response, sent }
}

function requestWith(authorization?: string): Request {
	return { headers: { authorization } } as unknown as Request
}

describe("surveillance of the worker", () => {
	it("CAP-028-R06 is ready while the database answers and not ready without it", async () => {
		const up = recorder()
		const down = recorder()

		expect(
			await harness({ isDatabaseUp: true, isStoreConfigured: true, token: undefined }).controller.ready(up.response),
		).toEqual({ status: "ok" })
		expect(
			await harness({ isDatabaseUp: false, isStoreConfigured: true, token: undefined }).controller.ready(down.response),
		).toEqual({ status: "unavailable" })
		expect(up.sent.status).toBeUndefined()
		expect(down.sent.status).toBe(503)
	})

	it("CAP-028-R20 reports its own dependencies on the reserved port", async () => {
		const { controller, dependencies } = harness({ isDatabaseUp: true, isStoreConfigured: true, token: undefined })
		dependencies.clinicalRecordStore.recordUnavailability(Date.now())
		const { response, sent } = recorder()

		await controller.dependencies(requestWith(), response)

		const expected: Record<string, DependencyState> = {
			database: DEPENDENCY_STATE.AVAILABLE,
			clinical_record_store: DEPENDENCY_STATE.UNAVAILABLE,
		}
		expect(sent.body).toEqual({ dependencies: expected })
	})

	it("reports an unconfigured store as unavailable", async () => {
		const { service } = harness({ isDatabaseUp: true, isStoreConfigured: false, token: undefined })

		expect((await service.dependencyStates()).clinical_record_store).toBe(DEPENDENCY_STATE.UNAVAILABLE)
	})

	it("CAP-028-S01 hands its metrics out in OpenMetrics", async () => {
		const { controller } = harness({ isDatabaseUp: false, isStoreConfigured: true, token: undefined })
		const { response, sent } = recorder()

		await controller.metrics(requestWith(), response)

		expect(sent.type).toBe("application/openmetrics-text; version=1.0.0; charset=utf-8")
		expect(sent.body).toContain('vulna_dependency{dependency="database",vulna_dependency="unavailable"} 1')
		expect(sent.body).toContain('vulna_dependency{dependency="clinical_record_store",vulna_dependency="unknown"} 1')
	})

	it("CAP-028-S05 refuses the details without the token the installation chose", async () => {
		const { controller, service } = harness({ isDatabaseUp: true, isStoreConfigured: true, token: TOKEN })
		const refused = recorder()

		await controller.metrics(requestWith(), refused.response)

		expect(refused.sent.status).toBe(401)
		expect(refused.sent.body).toBeUndefined()
		expect(service.accessOf(`Bearer ${TOKEN}`)).toBe(SURVEILLANCE_ACCESS.GRANTED)
	})
})
