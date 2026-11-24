import { API_BASE_PATH } from "@ansora/contracts"
import { OPENMETRICS_CONTENT_TYPE, SURVEILLANCE_ACCESS, type SurveillanceAccess } from "@ansora/core-server"
import { Module, type Type } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import type { NestExpressApplication } from "@nestjs/platform-express"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { DatabaseService } from "../../../libs/database/database.service"
import { HealthController } from "../../infra/controllers/health.controller"
import { applyApiPrefix } from "../../infra/hosting/api-prefix"
import { SurveillanceController } from "../controllers/surveillance.controller"
import { SurveillanceService } from "../services/surveillance.service"
import { SurveillanceAccessService } from "../services/surveillance-access.service"

const PARAMETER_TYPES = "design:paramtypes"
const METRICS_TEXT = "# EOF\n"
const DEPENDENCIES = { database: "available" }

function injects(target: Type<unknown>, dependencies: readonly Type<unknown>[]): void {
	Reflect.defineMetadata(PARAMETER_TYPES, dependencies, target)
}

injects(SurveillanceController, [SurveillanceAccessService, SurveillanceService])
injects(HealthController, [DatabaseService])

const state: { access: SurveillanceAccess } = { access: SURVEILLANCE_ACCESS.GRANTED }

@Module({
	controllers: [SurveillanceController, HealthController],
	providers: [
		{ provide: DatabaseService, useValue: { sql: async () => [] } },
		{ provide: SurveillanceAccessService, useValue: { accessOf: () => state.access } },
		{
			provide: SurveillanceService,
			useValue: { metricsText: async () => METRICS_TEXT, dependencyStates: async () => DEPENDENCIES },
		},
	],
})
class SurveillanceHttpTestModule {}

let app: NestExpressApplication
let baseUrl: string

beforeAll(async () => {
	app = await NestFactory.create<NestExpressApplication>(SurveillanceHttpTestModule, { logger: false })
	applyApiPrefix(app)
	await app.listen(0)
	baseUrl = await app.getUrl()
})

afterAll(async () => {
	await app.close()
})

beforeEach(() => {
	state.access = SURVEILLANCE_ACCESS.GRANTED
})

describe("surveillance endpoints of the API over HTTP", () => {
	it("CAP-028-S01 serves the metrics as OpenMetrics outside the API prefix", async () => {
		const response = await fetch(`${baseUrl}/metrics`)

		expect(response.status).toBe(200)
		const contentType = response.headers
			.get("content-type")
			?.split(";")
			.map((part) => part.trim())
		expect(contentType?.toSorted()).toEqual(OPENMETRICS_CONTENT_TYPE.split("; ").toSorted())
		expect(await response.text()).toBe(METRICS_TEXT)
	})

	it("CAP-028-R05 serves the state of the dependencies", async () => {
		const response = await fetch(`${baseUrl}/health/dependencies`)

		expect(response.status).toBe(200)
		expect(await response.json()).toEqual({ dependencies: DEPENDENCIES })
	})

	it("CAP-028-S05 answers a client without the token with a bare 401", async () => {
		state.access = SURVEILLANCE_ACCESS.UNAUTHENTICATED

		const response = await fetch(`${baseUrl}/metrics`)

		expect(response.status).toBe(401)
		expect(response.headers.get("www-authenticate")).toBe("Bearer")
		expect(await response.text()).toBe("")
	})

	it("CAP-028-R06 serves live and ready outside the API prefix", async () => {
		expect((await fetch(`${baseUrl}/health/live`)).status).toBe(200)
		expect((await fetch(`${baseUrl}/health/ready`)).status).toBe(200)
		expect((await fetch(`${baseUrl}${API_BASE_PATH}/health/live`)).status).toBe(404)
	})

	it("serves nothing for surveillance under the API prefix", async () => {
		expect((await fetch(`${baseUrl}${API_BASE_PATH}/metrics`)).status).toBe(404)
		expect((await fetch(`${baseUrl}${API_BASE_PATH}/health/dependencies`)).status).toBe(404)
	})

	it("CAP-028-S05 hides the details where the installation did not expose them", async () => {
		state.access = SURVEILLANCE_ACCESS.NOT_EXPOSED

		const response = await fetch(`${baseUrl}/health/dependencies`)

		expect(response.status).toBe(404)
		expect(await response.text()).toBe("")
	})
})
