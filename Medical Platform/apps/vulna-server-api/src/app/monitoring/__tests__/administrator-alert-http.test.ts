import { ADMINISTRATION_ERROR_CODE } from "@ansora/contracts"
import { HttpStatus, Module } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { AdministrationSessionService } from "../../administration-session/services/administration-session.service"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import { ADMINISTRATOR, ALERT_ID, READER } from "../../delivery-monitoring/__tests__/delivery-monitoring-fixtures"
import {
	type AdministrationHttp,
	codeOf,
	injects,
	startAdministrationHttp,
} from "../../infra/__tests__/administration-http"
import { AdministrationSessionGuard } from "../../infra/guards/administration-session.guard"
import { ALERTS_SUBPATH, MONITORING_PATH } from "../constants/monitoring.constants"
import { MonitoringController } from "../controllers/monitoring.controller"
import { AdministratorAlertService } from "../services/administrator-alert.service"
import { AdministratorAlertAcknowledgementService } from "../services/administrator-alert-acknowledgement.service"
import { ClinicalRecordWriteRequeueService } from "../services/clinical-record-write-requeue.service"
import { OperationalMetricsService } from "../services/operational-metrics.service"

const MANAGER_TOKEN = "manager"
const READER_TOKEN = "reader"
const ACKNOWLEDGEMENT_PATH = `${MONITORING_PATH}/${ALERTS_SUBPATH}/${ALERT_ID}/acknowledgement`

const SESSIONS: Readonly<Record<string, AdministrationSession>> = {
	[MANAGER_TOKEN]: ADMINISTRATOR,
	[READER_TOKEN]: READER,
}

const acknowledged: string[][] = []

injects(AdministrationSessionGuard, [AdministrationSessionService, Reflector])
injects(MonitoringController, [
	AdministratorAlertService,
	AdministratorAlertAcknowledgementService,
	ClinicalRecordWriteRequeueService,
	OperationalMetricsService,
])

@Module({
	controllers: [MonitoringController],
	providers: [
		Reflector,
		AdministrationSessionGuard,
		{ provide: AdministrationSessionService, useValue: { resolve: async (token: string) => SESSIONS[token] } },
		{
			provide: AdministratorAlertAcknowledgementService,
			useValue: {
				acknowledge: async (alertId: string, administrator: AdministrationSession) =>
					void acknowledged.push([alertId, administrator.userId]),
			},
		},
		{ provide: AdministratorAlertService, useValue: {} },
		{ provide: ClinicalRecordWriteRequeueService, useValue: {} },
		{ provide: OperationalMetricsService, useValue: {} },
	],
})
class AdministratorAlertHttpTestModule {}

let http: AdministrationHttp

beforeAll(async () => {
	http = await startAdministrationHttp(AdministratorAlertHttpTestModule)
})

afterAll(async () => {
	await http.close()
})

beforeEach(() => {
	acknowledged.length = 0
})

describe("acknowledging an alert over HTTP ✓ CAP-023-R12, administration.yaml acknowledgeAdministratorAlert", () => {
	it("CAP-023-R12 acknowledges a warning by the administrator with HTTP 204", async () => {
		const response = await http.request(ACKNOWLEDGEMENT_PATH, MANAGER_TOKEN, { method: "POST" })

		expect(response.status).toBe(HttpStatus.NO_CONTENT)
		expect(acknowledged).toEqual([[ALERT_ID, ADMINISTRATOR.userId]])
	})

	it("CAP-003-R13 refuses the acknowledgement to an administrator without the monitoring permission", async () => {
		const response = await http.request(ACKNOWLEDGEMENT_PATH, READER_TOKEN, { method: "POST" })

		expect(response.status).toBe(HttpStatus.FORBIDDEN)
		expect(await codeOf(response)).toBe(ADMINISTRATION_ERROR_CODE.PERMISSION_DENIED)
		expect(acknowledged).toEqual([])
	})
})
