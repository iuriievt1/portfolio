import { randomUUID } from "node:crypto"
import {
	ADMINISTRATION_ERROR_CODE,
	ADMINISTRATOR_ALERT_KIND,
	AUDIT_EXPORT_STAGE,
	AUDIT_EXPORT_STATE,
	CONFIGURATION_KEY,
} from "@ansora/contracts"
import {
	AUDIT_ACTOR_KIND,
	AUDIT_CHAIN_OUTCOME,
	AUDIT_EVENT_TYPE,
	AUDIT_OUTCOME,
	type AuditChainCheck,
	AuditChainVerifier,
	type AuditEventType,
	type AuditOutcome,
	type JsonObject,
	PERMISSION,
} from "@ansora/core-server"
import { HttpStatus, Injectable, Logger, NotFoundException } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import { ConfigurationService } from "../../configuration/services/configuration.service"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { decodePageCursor, encodePageCursor } from "../../infra/utils/page-cursor"
import { pageLimit } from "../../infra/utils/page-limit"
import { AdministratorAlertRepository } from "../../monitoring/repositories/administrator-alert.repository"
import { alertRaisedDetailsOf } from "../../monitoring/utils/alert-audit-event"
import { brokenAuditChainMessageOf } from "../../monitoring/utils/alert-messages"
import {
	CHAIN_READ_BATCH,
	EXPORT_FILE_PREFIX,
	EXPORT_READ_BATCH,
	exportFileLink,
	ISO_DATE_LENGTH,
} from "../constants/audit-administration.constants"
import type { AuditExportInput } from "../dto/audit-export.input.dto"
import type { AuditSearchInput } from "../dto/audit-search.input.dto"
import { AuditRepository } from "../repositories/audit.repository"
import { AuditQueryRepository, trailRecordOf } from "../repositories/audit-query.repository"
import type { AuditExportRow, AuditFilter, BrokenAuditRecord, NewAuditEvent } from "../types/audit.types"
import type {
	AuditChainCheckView,
	AuditExportFile,
	AuditExportStatusView,
	AuditExportView,
	AuditRecordsPage,
} from "../types/audit-administration.types"
import { csvHeader, csvLine } from "../utils/audit-csv"
import { auditRecordView } from "../utils/audit-record-view"

function filterOf(input: AuditSearchInput): AuditFilter {
	return {
		from: input.from,
		to: input.to,
		user: input.user,
		systemJob: input.system_job,
		device: input.device,
		eventType: input.event_type,
		patientIdentifier: input.patient_identifier,
		outcome: input.outcome,
	}
}

function sequenceBefore(cursor: string | undefined): number | undefined {
	const decoded = decodePageCursor(cursor)
	const sequence = Number(decoded?.sortKey)
	return decoded === undefined || !Number.isSafeInteger(sequence) ? undefined : sequence
}

function iso(time: Date | null): string | null {
	return time === null ? null : time.toISOString()
}

function brokenRecordOf(check: AuditChainCheck): BrokenAuditRecord | undefined {
	if (check.firstBrokenRecordId === undefined || check.firstBrokenRecordAt === undefined) {
		return undefined
	}
	return { id: check.firstBrokenRecordId, occurredAt: check.firstBrokenRecordAt }
}

// CAP-025-R07, CAP-025-R21, NAB-349 až NAB-351, NAB-442
@Injectable()
export class AuditAdministrationService {
	private readonly logger = new Logger(AuditAdministrationService.name)

	constructor(
		private readonly database: DatabaseService,
		private readonly queries: AuditQueryRepository,
		private readonly audit: AuditRepository,
		private readonly configuration: ConfigurationService,
		private readonly alerts: AdministratorAlertRepository,
	) {}

	async search(input: AuditSearchInput): Promise<AuditRecordsPage> {
		const limit = pageLimit(input.limit, await this.configuration.pageSize())
		const rows = await this.queries.page(filterOf(input), limit + 1, sequenceBefore(input.cursor))
		const page = rows.slice(0, limit)
		const last = page.at(-1)
		return {
			items: page.map(auditRecordView),
			next_cursor:
				rows.length > limit && last !== undefined ? encodePageCursor({ sortKey: last.sequence, id: last.id }) : null,
		}
	}

	// CAP-025-R21, CAP-025-S13
	async verifyChain(administrator: AdministrationSession): Promise<AuditChainCheckView> {
		const verifier = new AuditChainVerifier()
		await this.queries.inChainOrder(
			async (rows) => rows.every((row) => verifier.accepts(trailRecordOf(row))),
			CHAIN_READ_BATCH,
		)
		const result = verifier.result()
		const checkedUntil = result.checkedUntil ?? new Date().toISOString()
		if (result.outcome === AUDIT_CHAIN_OUTCOME.INTACT) {
			await this.alerts.resolveBrokenAuditChain()
		}
		const brokenRecord = brokenRecordOf(result)
		if (brokenRecord !== undefined) {
			this.logger.error(`The audit chain is broken at record ${brokenRecord.id}`)
			await this.recordBrokenChain(administrator, brokenRecord, checkedUntil)
		}
		return {
			outcome: result.outcome,
			first_broken_record_id: result.firstBrokenRecordId,
			checked_until: checkedUntil,
		}
	}

	// CAP-025-S04
	async requestExport(input: AuditExportInput, administrator: AdministrationSession): Promise<AuditExportView> {
		if (!administrator.permissions.includes(PERMISSION.AUDIT_EXPORT)) {
			await this.record(administrator, AUDIT_EVENT_TYPE.AUDIT_EXPORT, AUDIT_OUTCOME.FAILURE, {
				details: { stage: AUDIT_EXPORT_STAGE.REQUESTED, reason: ADMINISTRATION_ERROR_CODE.PERMISSION_DENIED },
			})
			throw new ProblemException(HttpStatus.FORBIDDEN, ADMINISTRATION_ERROR_CODE.PERMISSION_DENIED)
		}
		if (input.from !== undefined && input.to !== undefined && Date.parse(input.from) > Date.parse(input.to)) {
			throw new ProblemException(
				HttpStatus.UNPROCESSABLE_ENTITY,
				ADMINISTRATION_ERROR_CODE.VALUE_OUT_OF_RANGE,
				"from is after to",
			)
		}
		const id = randomUUID()
		await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			const untilSequence = await this.queries.latestSequence(tx)
			await this.queries.insertExport(tx, {
				id,
				requestedBy: administrator.userId,
				requestedAt: new Date(),
				from: input.from,
				to: input.to,
				eventType: input.event_type,
				untilSequence,
			})
			await this.audit.append(
				tx,
				this.event(administrator, AUDIT_EVENT_TYPE.AUDIT_EXPORT, AUDIT_OUTCOME.SUCCESS, {
					objectId: id,
					details: {
						stage: AUDIT_EXPORT_STAGE.REQUESTED,
						from: input.from ?? null,
						to: input.to ?? null,
						event_type: input.event_type ?? null,
						until_sequence: untilSequence,
					},
				}),
			)
		})
		return {
			id,
			state: AUDIT_EXPORT_STATE.DONE,
			link: exportFileLink(id),
		}
	}

	// NAB-442
	async exportFile(id: string, administrator: AdministrationSession): Promise<AuditExportFile> {
		const row = await this.queries.findExport(id)
		if (row === undefined || row.requested_by !== administrator.userId) {
			throw new NotFoundException()
		}
		await this.record(administrator, AUDIT_EVENT_TYPE.AUDIT_EXPORT, AUDIT_OUTCOME.SUCCESS, {
			objectId: id,
			details: { stage: AUDIT_EXPORT_STAGE.DOWNLOADED },
		})
		return {
			fileName: `${EXPORT_FILE_PREFIX}-${row.requested_at.toISOString().slice(0, ISO_DATE_LENGTH)}.csv`,
			lines: this.lines(row),
		}
	}

	// CAP-025-R09, CAP-025-S03
	async exportStatus(): Promise<AuditExportStatusView> {
		const cursor = await this.queries.exportCursor()
		if (cursor === undefined) {
			throw new Error("the audit export cursor is missing; the migration step creates it")
		}
		const latest = await this.queries.latestSequence()
		const exported = Number(cursor.exported_sequence)
		const host = await this.configuration.value(CONFIGURATION_KEY.SYSLOG_HOST)
		return {
			configured: typeof host === "string" && host.trim() !== "",
			exported_until_sequence: exported,
			exported_at: iso(cursor.exported_at),
			latest_sequence: latest,
			pending_count: Math.max(0, latest - exported),
			buffer_limit: await this.configuration.integer(CONFIGURATION_KEY.AUDIT_EXPORT_BUFFER_MAX_RECORDS),
			attempted_at: iso(cursor.attempted_at),
			failing_since: iso(cursor.failing_since),
			last_failure: cursor.last_failure,
		}
	}

	private async *lines(row: AuditExportRow): AsyncIterable<string> {
		yield csvHeader()
		for await (const rows of this.queries.exported(row, EXPORT_READ_BATCH)) {
			for (const exported of rows) {
				yield csvLine(exported)
			}
		}
	}

	// CAP-025-R21, CAP-028-R15
	private async recordBrokenChain(
		administrator: AdministrationSession,
		brokenRecord: BrokenAuditRecord,
		checkedUntil: string,
	): Promise<void> {
		const message = brokenAuditChainMessageOf(new Date(brokenRecord.occurredAt))
		await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			await this.audit.append(
				tx,
				this.event(administrator, AUDIT_EVENT_TYPE.AUDIT_CHAIN_BROKEN, AUDIT_OUTCOME.FAILURE, {
					objectId: brokenRecord.id,
					details: { first_broken_record_id: brokenRecord.id, checked_until: checkedUntil },
				}),
			)
			const alertId = await this.alerts.raiseForBrokenAuditChain(tx, brokenRecord.id, message)
			if (alertId === undefined) {
				return
			}
			const alert = {
				alertId,
				kind: ADMINISTRATOR_ALERT_KIND.AUDIT_CHAIN_BROKEN,
				message,
				subject: { audit_record_id: brokenRecord.id },
			}
			await this.audit.append(
				tx,
				this.event(administrator, AUDIT_EVENT_TYPE.ADMINISTRATOR_ALERT_RAISED, AUDIT_OUTCOME.FAILURE, {
					objectId: alertId,
					details: alertRaisedDetailsOf(alert),
				}),
			)
		})
	}

	private async record(
		administrator: AdministrationSession,
		eventType: AuditEventType,
		outcome: AuditOutcome,
		subject: { objectId?: string; details: JsonObject },
	): Promise<void> {
		await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			await this.audit.append(tx, this.event(administrator, eventType, outcome, subject))
		})
	}

	private event(
		administrator: AdministrationSession,
		eventType: AuditEventType,
		outcome: AuditOutcome,
		subject: { objectId?: string; details: JsonObject },
	): NewAuditEvent {
		return {
			eventType,
			actorKind: AUDIT_ACTOR_KIND.USER,
			actorUserId: administrator.userId,
			objectId: subject.objectId,
			outcome,
			details: subject.details,
		}
	}
}
