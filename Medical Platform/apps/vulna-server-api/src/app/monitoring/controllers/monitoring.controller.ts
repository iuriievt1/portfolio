import { PERMISSION } from "@ansora/core-server"
import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common"
import { RequiresPermission } from "../../administration-session/decorators/requires-permission.decorator"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import { Administrator } from "../../infra/decorators/administrator.decorator"
import { OutsideMobileContract } from "../../infra/decorators/outside-mobile-contract.decorator"
import { AdministrationSessionGuard } from "../../infra/guards/administration-session.guard"
import { ZodValidationPipe } from "../../infra/pipes/zod-validation.pipe"
import {
	ALERT_ACKNOWLEDGEMENT_SUBPATH,
	ALERT_ID_PARAMETER,
	ALERTS_SUBPATH,
	CLINICAL_RECORD_WRITE_REQUEUE_SUBPATH,
	METRICS_SUBPATH,
	MONITORING_PATH,
} from "../constants/monitoring.constants"
import {
	type AdministratorAlertPageInput,
	administratorAlertPageSchema,
} from "../dto/administrator-alert-page.input.dto"
import { AdministratorAlertService } from "../services/administrator-alert.service"
import { AdministratorAlertAcknowledgementService } from "../services/administrator-alert-acknowledgement.service"
import { ClinicalRecordWriteRequeueService } from "../services/clinical-record-write-requeue.service"
import { OperationalMetricsService } from "../services/operational-metrics.service"
import type { AdministratorAlertsPageView, OperationalMetricsView } from "../types/monitoring.types"

// CAP-028-R13, CAP-028-R15, CAP-021-R27
@OutsideMobileContract()
@UseGuards(AdministrationSessionGuard)
@Controller(MONITORING_PATH)
export class MonitoringController {
	constructor(
		private readonly alerts: AdministratorAlertService,
		private readonly acknowledgements: AdministratorAlertAcknowledgementService,
		private readonly requeues: ClinicalRecordWriteRequeueService,
		private readonly metrics: OperationalMetricsService,
	) {}

	// CAP-028-R13, CAP-028-R14, CAP-028-S06
	@Get(METRICS_SUBPATH)
	@RequiresPermission(PERMISSION.ADMINISTRATION_ACCESS)
	async operationalMetrics(): Promise<OperationalMetricsView> {
		return await this.metrics.current(Date.now())
	}

	@Get(ALERTS_SUBPATH)
	@RequiresPermission(PERMISSION.ADMINISTRATION_ACCESS)
	async listAlerts(
		@Query(new ZodValidationPipe(administratorAlertPageSchema)) query: AdministratorAlertPageInput,
	): Promise<AdministratorAlertsPageView> {
		return await this.alerts.list(query)
	}

	// CAP-023-R12, CAP-023-S21
	@Post(ALERT_ACKNOWLEDGEMENT_SUBPATH)
	@HttpCode(HttpStatus.NO_CONTENT)
	@RequiresPermission(PERMISSION.MONITORING_MANAGE)
	async acknowledgeAlert(
		@Param(ALERT_ID_PARAMETER, ParseUUIDPipe) alertId: string,
		@Administrator() administrator: AdministrationSession,
	): Promise<void> {
		await this.acknowledgements.acknowledge(alertId, administrator)
	}

	// CAP-021-S25
	@Post(CLINICAL_RECORD_WRITE_REQUEUE_SUBPATH)
	@HttpCode(HttpStatus.NO_CONTENT)
	@RequiresPermission(PERMISSION.MONITORING_MANAGE)
	async requeueClinicalRecordWrite(
		@Param("taskId", ParseUUIDPipe) taskId: string,
		@Administrator() administrator: AdministrationSession,
	): Promise<void> {
		await this.requeues.requeue(taskId, administrator)
	}
}
