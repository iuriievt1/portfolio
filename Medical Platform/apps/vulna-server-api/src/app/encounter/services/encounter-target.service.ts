import { ERROR_CODE } from "@ansora/contracts"
import { ENCOUNTER_STATUS, newRecordRefusalOf, uidOfUuid } from "@ansora/vulna-domain"
import { HttpStatus, Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { RejectedEncounterAction } from "../exceptions/rejected-encounter-action.exception"
import { EncounterRepository } from "../repositories/encounter.repository"
import type { EncounterReference, EncounterRow, EncounterTargetContext } from "../types/encounter.types"
import { encounterIdOfKey, encounterKeyOf } from "../utils/encounter-identity"

// CAP-014-R06, CAP-014-R07, CAP-014-R18, CAP-014-R26, CAP-014-S19, CAP-014-S43, CAP-014-S45
@Injectable()
export class EncounterTargetService {
	constructor(private readonly encounters: EncounterRepository) {}

	async lockTarget(
		tx: postgres.TransactionSql,
		reference: EncounterReference,
		context: EncounterTargetContext,
	): Promise<EncounterRow> {
		if (reference.encounter_id !== undefined) {
			return await this.lockExisting(tx, reference.encounter_id, context)
		}
		return await this.lockOrCreateByKey(tx, encounterKeyOf(reference), context)
	}

	private async lockExisting(
		tx: postgres.TransactionSql,
		encounterId: string,
		context: EncounterTargetContext,
	): Promise<EncounterRow> {
		const existing = await this.encounters.lockById(tx, encounterId)
		if (existing === undefined) {
			throw new ProblemException(HttpStatus.NOT_FOUND, ERROR_CODE.RESOURCE_NOT_FOUND)
		}
		if (existing.patient_id !== context.patientId) {
			throw new ProblemException(HttpStatus.UNPROCESSABLE_ENTITY, ERROR_CODE.PATIENT_MISMATCH)
		}
		this.rejectClosed(existing, context)
		if (existing.status !== ENCOUNTER_STATUS.PLANNED) {
			return existing
		}
		return await this.encounters.start(tx, existing.id, context.now)
	}

	private async lockOrCreateByKey(
		tx: postgres.TransactionSql,
		encounterKey: string,
		context: EncounterTargetContext,
	): Promise<EncounterRow> {
		const known = await this.encounters.lockByKey(tx, encounterKey)
		if (known !== undefined) {
			if (known.patient_id !== context.patientId) {
				throw new ProblemException(HttpStatus.CONFLICT, ERROR_CODE.IDEMPOTENCY_CONFLICT)
			}
			this.rejectClosed(known, context)
			return known
		}
		const id = encounterIdOfKey(encounterKey)
		return await this.encounters.insertCreatedInApp(tx, {
			id,
			patientId: context.patientId,
			encounterKey,
			date: context.today,
			departmentId: context.departmentId,
			studyInstanceUid: uidOfUuid(id),
			startedAt: context.now,
		})
	}

	// CAP-014-R21, CAP-014-R29, CAP-014-R30, CAP-025-R27
	private rejectClosed(encounter: EncounterRow, context: EncounterTargetContext): void {
		const refusal = newRecordRefusalOf(encounter, context.today)
		if (refusal !== undefined) {
			throw new RejectedEncounterAction(refusal, encounter, context.action)
		}
	}
}
