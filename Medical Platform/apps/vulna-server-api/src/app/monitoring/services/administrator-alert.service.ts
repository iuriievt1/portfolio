import { Injectable } from "@nestjs/common"
import { ConfigurationService } from "../../configuration/services/configuration.service"
import { pageLimit } from "../../infra/utils/page-limit"
import type { AdministratorAlertPageInput } from "../dto/administrator-alert-page.input.dto"
import { AdministratorAlertRepository } from "../repositories/administrator-alert.repository"
import type { AdministratorAlertsPageView } from "../types/monitoring.types"
import { administratorAlertViewOf } from "../utils/administrator-alert-view"

// CAP-028-R15, administration.yaml listAdministratorAlerts
@Injectable()
export class AdministratorAlertService {
	constructor(
		private readonly alerts: AdministratorAlertRepository,
		private readonly configuration: ConfigurationService,
	) {}

	async list(query: AdministratorAlertPageInput): Promise<AdministratorAlertsPageView> {
		const limit = pageLimit(query.limit, await this.configuration.pageSize())
		const page = await this.alerts.page({ limit, cursor: query.cursor, kind: query.kind, isActive: query.is_active })
		return { items: page.rows.map(administratorAlertViewOf), next_cursor: page.nextCursor }
	}
}
