import { ACQUISITION_STATE } from "@ansora/vulna-domain"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import type { Executor } from "../../../libs/database/database.service"
import type { CurrentSession } from "../../login/types/login.types"
import { AcquisitionDraftRepository } from "../repositories/acquisition-draft.repository"
import { DecidedAcquisitionRepository } from "../repositories/decided-acquisition.repository"
import type { AcquisitionRow } from "../types/acquisition.types"
import type { QueueSender } from "../types/queue-sender.types"
import { alreadyDecided, closed, notFound } from "../utils/acquisition-problems"
import { sentRecordOf } from "../utils/queue-sender"

// CAP-015-R17
function ownOrMissing(row: AcquisitionRow | undefined, current: CurrentSession): AcquisitionRow | undefined {
	if (row !== undefined && row.operator_user_id !== current.session.userId) {
		throw notFound()
	}
	return row
}

// CAP-014-R07, CAP-015-R18, CAP-021-R32
function changeable(row: AcquisitionRow | undefined): AcquisitionRow {
	if (row === undefined) {
		throw notFound()
	}
	if (row.state !== ACQUISITION_STATE.DRAFT) {
		throw closed()
	}
	return row
}

// CAP-015-R17, CAP-019-R14, CAP-021-R32
@Injectable()
export class DraftAccessService {
	constructor(
		private readonly drafts: AcquisitionDraftRepository,
		private readonly decided: DecidedAcquisitionRepository,
	) {}

	async findOwn(sql: Executor, current: CurrentSession, acquisitionId: string): Promise<AcquisitionRow | undefined> {
		return ownOrMissing(await this.drafts.findById(sql, acquisitionId), current)
	}

	async lockOwn(
		tx: postgres.TransactionSql,
		current: CurrentSession,
		acquisitionId: string,
	): Promise<AcquisitionRow | undefined> {
		return ownOrMissing(await this.drafts.lockById(tx, acquisitionId), current)
	}

	// CAP-019-R14, CAP-019-S18, CAP-021-R23, CAP-002-R09
	async receivingRecord(sql: Executor, sender: QueueSender, acquisitionId: string): Promise<AcquisitionRow> {
		return await this.kept(sql, acquisitionId, sentRecordOf(await this.drafts.findById(sql, acquisitionId), sender))
	}

	async lockedReceivingRecord(
		tx: postgres.TransactionSql,
		sender: QueueSender,
		acquisitionId: string,
	): Promise<AcquisitionRow> {
		return await this.kept(tx, acquisitionId, sentRecordOf(await this.drafts.lockById(tx, acquisitionId), sender))
	}

	// CAP-019-R14, CAP-021-R29
	async undecidedDraft(
		sql: Executor,
		current: CurrentSession,
		acquisitionId: string,
	): Promise<AcquisitionRow | undefined> {
		const known = await this.findOwn(sql, current, acquisitionId)
		if (known === undefined) {
			if (await this.decided.isDecided(sql, acquisitionId)) {
				return undefined
			}
			throw notFound()
		}
		if (known.state !== ACQUISITION_STATE.DRAFT) {
			throw closed()
		}
		return known
	}

	async changeableDraft(sql: Executor, current: CurrentSession, acquisitionId: string): Promise<AcquisitionRow> {
		return changeable(await this.findOwn(sql, current, acquisitionId))
	}

	async lockedChangeableDraft(
		tx: postgres.TransactionSql,
		current: CurrentSession,
		acquisitionId: string,
	): Promise<AcquisitionRow> {
		return changeable(await this.lockOwn(tx, current, acquisitionId))
	}

	// CAP-019-R14, CAP-019-S18
	private async kept(sql: Executor, acquisitionId: string, row: AcquisitionRow | undefined): Promise<AcquisitionRow> {
		if (row === undefined) {
			throw (await this.decided.isDecided(sql, acquisitionId)) ? alreadyDecided() : notFound()
		}
		return row
	}
}
