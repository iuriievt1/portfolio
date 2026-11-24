import {
	ADMINISTRATION_ERROR_CODE,
	DELIVERY_CLOSURE_REASON,
	DELIVERY_INSTANCE_STATE,
	DELIVERY_TARGET_STATE,
	ERROR_CODE,
} from "@ansora/contracts"
import { HttpStatus, Module } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { AdministrationSessionService } from "../../administration-session/services/administration-session.service"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import {
	type AdministrationHttp,
	codeOf,
	injects,
	startAdministrationHttp,
} from "../../infra/__tests__/administration-http"
import { AdministrationSessionGuard } from "../../infra/guards/administration-session.guard"
import { DELIVERY_TARGETS_PATH, MONITORED_DELIVERIES_PATH } from "../constants/delivery-monitoring.constants"
import { DeliveryTargetController } from "../controllers/delivery-target.controller"
import { MonitoredDeliveryController } from "../controllers/monitored-delivery.controller"
import type { DeliveryClosureInput } from "../dto/delivery-closure.input.dto"
import type { DeliveryPageInput } from "../dto/delivery-page.input.dto"
import type { TextRecognitionRestartInput } from "../dto/text-recognition-restart.input.dto"
import { DeliveryClosureService } from "../services/delivery-closure.service"
import { DeliveryOverviewService } from "../services/delivery-overview.service"
import { DeliveryTargetResumptionService } from "../services/delivery-target-resumption.service"
import { DeliveryVerificationResumptionService } from "../services/delivery-verification-resumption.service"
import { TextRecognitionRestartService } from "../services/text-recognition-restart.service"
import type { DeliveryTargetView } from "../types/delivery-monitoring.types"
import {
	ADMINISTRATOR,
	DELIVERY,
	DELIVERY_ID,
	INSTANCE_ID,
	PACS,
	READER,
	RESTART_REASON,
} from "./delivery-monitoring-fixtures"

const MANAGER_TOKEN = "manager"
const READER_TOKEN = "reader"
const OUTSIDER_TOKEN = "outsider"
const INSTANCE_PATH = `${MONITORED_DELIVERIES_PATH}/${DELIVERY_ID}/instances/${INSTANCE_ID}`
const CLOSURE_PATH = `${INSTANCE_PATH}/closure`
const RESTART_PATH = `${MONITORED_DELIVERIES_PATH}/${DELIVERY_ID}/text-recognition-restart`

// CAP-003-R13, CAP-028-S06
const OUTSIDER: AdministrationSession = {
	...READER,
	sessionId: "7c6b5a49-3827-4160-8e5d-4c3b2a190807",
	permissions: [],
}

const SESSIONS: Readonly<Record<string, AdministrationSession>> = {
	[MANAGER_TOKEN]: ADMINISTRATOR,
	[READER_TOKEN]: READER,
	[OUTSIDER_TOKEN]: OUTSIDER,
}

const TARGET: DeliveryTargetView = {
	code: PACS,
	state: DELIVERY_TARGET_STATE.PAUSED,
	reason: "STORE.A705",
	changed_at: "2026-11-09T09:00:00.000Z",
}

const calls = {
	listed: [] as DeliveryPageInput[],
	detailed: [] as string[],
	closed: [] as unknown[][],
	restarted: [] as unknown[][],
}

injects(AdministrationSessionGuard, [AdministrationSessionService, Reflector])
injects(MonitoredDeliveryController, [
	DeliveryOverviewService,
	DeliveryVerificationResumptionService,
	DeliveryClosureService,
	TextRecognitionRestartService,
])
injects(DeliveryTargetController, [DeliveryOverviewService, DeliveryTargetResumptionService])

@Module({
	controllers: [MonitoredDeliveryController, DeliveryTargetController],
	providers: [
		Reflector,
		AdministrationSessionGuard,
		{ provide: AdministrationSessionService, useValue: { resolve: async (token: string) => SESSIONS[token] } },
		{
			provide: DeliveryOverviewService,
			useValue: {
				list: async (query: DeliveryPageInput) => {
					calls.listed.push(query)
					return { items: [DELIVERY], next_cursor: null }
				},
				detail: async (deliveryId: string) => {
					calls.detailed.push(deliveryId)
					return DELIVERY
				},
				targets: async () => [TARGET],
			},
		},
		{
			provide: DeliveryClosureService,
			useValue: {
				close: async (
					deliveryId: string,
					instanceId: string,
					closure: DeliveryClosureInput,
					administrator: AdministrationSession,
				) => {
					calls.closed.push([deliveryId, instanceId, closure, administrator.userId])
					return DELIVERY
				},
			},
		},
		{
			provide: TextRecognitionRestartService,
			useValue: {
				restart: async (
					deliveryId: string,
					restart: TextRecognitionRestartInput,
					administrator: AdministrationSession,
				) => {
					calls.restarted.push([deliveryId, restart, administrator.userId])
					return DELIVERY
				},
			},
		},
		{ provide: DeliveryVerificationResumptionService, useValue: {} },
		{ provide: DeliveryTargetResumptionService, useValue: {} },
	],
})
class DeliveryMonitoringHttpTestModule {}

let http: AdministrationHttp

beforeAll(async () => {
	http = await startAdministrationHttp(DeliveryMonitoringHttpTestModule)
})

afterAll(async () => {
	await http.close()
})

beforeEach(() => {
	calls.listed.length = 0
	calls.detailed.length = 0
	calls.closed.length = 0
	calls.restarted.length = 0
})

describe("delivery monitoring over HTTP ✓ CAP-028-R12, administration.yaml listDeliveries, closeDeliveryInstance", () => {
	it("NAB-345 lists the deliveries filtered by the state of an instance for an administrator who only reads", async () => {
		const response = await http.request(
			`${MONITORED_DELIVERIES_PATH}?instance_state=${DELIVERY_INSTANCE_STATE.HELD_FOR_REVIEW}`,
			READER_TOKEN,
		)

		expect(response.status).toBe(HttpStatus.OK)
		expect(await response.json()).toEqual({ items: [DELIVERY], next_cursor: null })
		expect(calls.listed).toEqual([{ instance_state: DELIVERY_INSTANCE_STATE.HELD_FOR_REVIEW }])
	})

	it("CAP-023-S27 refuses the filter by the former name of the held state", async () => {
		const response = await http.request(`${MONITORED_DELIVERIES_PATH}?instance_state=clinical_safety`, READER_TOKEN)

		expect(response.status).toBe(HttpStatus.BAD_REQUEST)
		expect(await codeOf(response)).toBe(ERROR_CODE.RECORD_REJECTED)
		expect(calls.listed).toEqual([])
	})

	it("NAB-398 hands over one delivery and refuses an identifier that is not one", async () => {
		const found = await http.request(`${MONITORED_DELIVERIES_PATH}/${DELIVERY_ID}`, READER_TOKEN)
		const malformed = await http.request(`${MONITORED_DELIVERIES_PATH}/not-a-delivery`, READER_TOKEN)

		expect(found.status).toBe(HttpStatus.OK)
		expect(await found.json()).toEqual(DELIVERY)
		expect(malformed.status).toBe(HttpStatus.BAD_REQUEST)
		expect(calls.detailed).toEqual([DELIVERY_ID])
	})

	it("NAB-397 hands over the delivery targets with their state", async () => {
		const response = await http.request(DELIVERY_TARGETS_PATH, READER_TOKEN)

		expect(response.status).toBe(HttpStatus.OK)
		expect(await response.json()).toEqual([TARGET])
	})

	it.each([MONITORED_DELIVERIES_PATH, `${MONITORED_DELIVERIES_PATH}/${DELIVERY_ID}`, DELIVERY_TARGETS_PATH])(
		"CAP-028-S06 shows nothing of %s to a user without the administration role",
		async (path) => {
			const response = await http.request(path, OUTSIDER_TOKEN)

			expect(response.status).toBe(HttpStatus.FORBIDDEN)
			expect(await codeOf(response)).toBe(ADMINISTRATION_ERROR_CODE.PERMISSION_DENIED)
		},
	)

	it("CAP-023-S26 refuses a closure without a reason with HTTP 400 and closes nothing", async () => {
		const response = await http.request(CLOSURE_PATH, MANAGER_TOKEN, { method: "POST", body: JSON.stringify({}) })

		expect(response.status).toBe(HttpStatus.BAD_REQUEST)
		expect(await codeOf(response)).toBe(ERROR_CODE.RECORD_REJECTED)
		expect(calls.closed).toEqual([])
	})

	it("CAP-023-S26 offers no operation that would send an instance again", async () => {
		const response = await http.request(`${INSTANCE_PATH}/retry`, MANAGER_TOKEN, { method: "POST" })

		expect(response.status).toBe(HttpStatus.NOT_FOUND)
	})

	it("CAP-023-S24 closes the instance of the delivery with a reason and answers with the delivery", async () => {
		const closure = { reason: DELIVERY_CLOSURE_REASON.DOCUMENTATION_REACQUIRED, note: "Pořízeno znovu" }

		const response = await http.request(CLOSURE_PATH, MANAGER_TOKEN, { method: "POST", body: JSON.stringify(closure) })

		expect(response.status).toBe(HttpStatus.OK)
		expect(await response.json()).toEqual(DELIVERY)
		expect(calls.closed).toEqual([[DELIVERY_ID, INSTANCE_ID, closure, ADMINISTRATOR.userId]])
	})

	it("CAP-003-R13 refuses the closure to an administrator without the monitoring permission", async () => {
		const response = await http.request(CLOSURE_PATH, READER_TOKEN, {
			method: "POST",
			body: JSON.stringify({ reason: DELIVERY_CLOSURE_REASON.NOT_REQUIRED }),
		})

		expect(response.status).toBe(HttpStatus.FORBIDDEN)
		expect(await codeOf(response)).toBe(ADMINISTRATION_ERROR_CODE.PERMISSION_DENIED)
		expect(calls.closed).toEqual([])
	})

	it("CAP-022-S06 restarts the text recognition with a reason and answers with the delivery as accepted", async () => {
		const response = await http.request(RESTART_PATH, MANAGER_TOKEN, {
			method: "POST",
			body: JSON.stringify({ reason: ` ${RESTART_REASON} ` }),
		})

		expect(response.status).toBe(HttpStatus.ACCEPTED)
		expect(await response.json()).toEqual(DELIVERY)
		expect(calls.restarted).toEqual([[DELIVERY_ID, { reason: RESTART_REASON }, ADMINISTRATOR.userId]])
	})

	it.each([{}, { reason: "   " }, { reason: RESTART_REASON, retry: true }])(
		"CAP-022-R15 refuses the restart body %j with HTTP 400 and restarts nothing",
		async (body) => {
			const response = await http.request(RESTART_PATH, MANAGER_TOKEN, { method: "POST", body: JSON.stringify(body) })

			expect(response.status).toBe(HttpStatus.BAD_REQUEST)
			expect(await codeOf(response)).toBe(ERROR_CODE.RECORD_REJECTED)
			expect(calls.restarted).toEqual([])
		},
	)

	it("CAP-003-R13 refuses the restart to an administrator without the monitoring permission", async () => {
		const response = await http.request(RESTART_PATH, READER_TOKEN, {
			method: "POST",
			body: JSON.stringify({ reason: RESTART_REASON }),
		})

		expect(response.status).toBe(HttpStatus.FORBIDDEN)
		expect(await codeOf(response)).toBe(ADMINISTRATION_ERROR_CODE.PERMISSION_DENIED)
		expect(calls.restarted).toEqual([])
	})
})
