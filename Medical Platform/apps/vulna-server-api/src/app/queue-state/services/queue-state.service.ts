import { Injectable } from "@nestjs/common"
import { DatabaseService } from "../../../libs/database/database.service"
import { AcquisitionFileRepository } from "../../acquisition/repositories/acquisition-file.repository"
import { ConfigurationService } from "../../configuration/services/configuration.service"
import { pageLimit } from "../../infra/utils/page-limit"
import type { QueueReportInput } from "../dto/queue-report.input.dto"
import type { QueueStateQueryInput } from "../dto/queue-state.input.dto"
import { QueueReportRepository } from "../repositories/queue-report.repository"
import { QueueStateRepository } from "../repositories/queue-state.repository"
import type { QueueCaller, QueueStatesPageView } from "../types/queue-state.types"
import { callerDeviceOf, queueStateScopeOf } from "../utils/queue-caller"
import { queueReportOf } from "../utils/queue-report"
import { acquisitionStateOf, receivedKeysByAcquisition } from "../utils/queue-state-view"

@Injectable()
export class QueueStateService {
	constructor(
		private readonly database: DatabaseService,
		private readonly configuration: ConfigurationService,
		private readonly states: QueueStateRepository,
		private readonly files: AcquisitionFileRepository,
		private readonly reports: QueueReportRepository,
	) {}

	// CAP-019-R30, CAP-019-R24, CAP-019-R12
	async list(caller: QueueCaller, query: QueueStateQueryInput): Promise<QueueStatesPageView> {
		const limit = pageLimit(query.limit, await this.configuration.pageSize())
		const scope = queueStateScopeOf(caller, query.acquisition_keys)
		const page = await this.states.listFromDevice(scope, query.cursor, limit)
		const received = receivedKeysByAcquisition(
			await this.files.receivedKeysOf(
				this.database.sql,
				page.rows.map((row) => row.id),
			),
		)
		return {
			items: page.rows.map((row) => acquisitionStateOf(row, received.get(row.id) ?? [])),
			next_cursor: page.nextCursor,
		}
	}

	// CAP-019-R08, CAP-007-S08
	async report(caller: QueueCaller, input: QueueReportInput, receivedAt: Date): Promise<void> {
		await this.reports.record(callerDeviceOf(caller).id, queueReportOf(input), receivedAt)
	}
}
