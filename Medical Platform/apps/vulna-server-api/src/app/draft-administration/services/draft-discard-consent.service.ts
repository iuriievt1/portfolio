import { randomUUID } from "node:crypto"
import {
	ADMINISTRATION_ERROR_CODE,
	AUDIT_DISCARD_SITUATION,
	DRAFT_DISCARD_REFUSAL,
	EMPTIED_BY,
} from "@ansora/contracts"
import { AUDIT_EVENT_TYPE, CONFIGURATION_KEY } from "@ansora/core-server"
import { ACQUISITION_STATE } from "@ansora/vulna-domain"
import { HttpStatus, Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import { DECISION_REASON } from "../../acquisition/constants/acquisition.constants"
import { AcquisitionDraftRepository } from "../../acquisition/repositories/acquisition-draft.repository"
import { type DraftDecision, DraftRemovalService } from "../../acquisition/services/draft-removal.service"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import type { AuditActor } from "../../audit/types/audit.types"
import { administratorActorOf } from "../../audit/utils/administrator-audit-event"
import { BinaryObjectService } from "../../binary-object/services/binary-object.service"
import { ConfigurationService } from "../../configuration/services/configuration.service"
import { EncounterRepository } from "../../encounter/repositories/encounter.repository"
import type { EncounterRow } from "../../encounter/types/encounter.types"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { OperatorNotificationRepository } from "../../operator-notification/repositories/operator-notification.repository"
import { AdministeredDraftRepository } from "../repositories/administered-draft.repository"
import { DraftDiscardConsentRepository } from "../repositories/draft-discard-consent.repository"
import { OperatorPresenceRepository } from "../repositories/operator-presence.repository"
import type {
	DiscardSelection,
	DraftDiscardConsent,
	DraftDiscardOutcome,
	DraftDiscardRequest,
	DraftDiscardResultView,
	DraftVerdict,
	SelectedDraft,
} from "../types/draft-administration.types"
import { isDiscardConsentAllowed } from "../utils/discard-consent"
import { consentGrantedEventOf } from "../utils/draft-administration-audit"

// CAP-015-R19, CAP-015-R20, CAP-025-R20, CAP-026-R16, administration.yaml discardAcquisitionDraftsWithConsent
@Injectable()
export class DraftDiscardConsentService {
	constructor(
		private readonly database: DatabaseService,
		private readonly presences: OperatorPresenceRepository,
		private readonly consents: DraftDiscardConsentRepository,
		private readonly administered: AdministeredDraftRepository,
		private readonly acquisitions: AcquisitionDraftRepository,
		private readonly encounters: EncounterRepository,
		private readonly removal: DraftRemovalService,
		private readonly notifications: OperatorNotificationRepository,
		private readonly binaries: BinaryObjectService,
		private readonly configuration: ConfigurationService,
		private readonly audit: AuditRepository,
	) {}

	async grant(
		administrator: AdministrationSession,
		request: DraftDiscardRequest,
		now: Date,
	): Promise<DraftDiscardResultView> {
		const absenceSeconds = await this.configuration.integer(CONFIGURATION_KEY.DRAFT_DISCARD_CONSENT_ABSENCE_SECONDS)
		const consent: DraftDiscardConsent = {
			id: randomUUID(),
			operatorUserId: request.operatorUserId,
			administratorUserId: administrator.userId,
			reason: request.reason,
			grantedAt: now,
		}
		const actor = administratorActorOf(administrator)
		const outcome = await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			const presence = await this.presences.lockPresence(tx, request.operatorUserId)
			if (presence === undefined) {
				throw new ProblemException(HttpStatus.NOT_FOUND, ADMINISTRATION_ERROR_CODE.NOT_FOUND)
			}
			if (!isDiscardConsentAllowed(presence, absenceSeconds, now)) {
				throw new ProblemException(HttpStatus.CONFLICT, ADMINISTRATION_ERROR_CODE.DRAFT_DISCARD_NOT_ALLOWED)
			}
			const discards = await this.discardSelected(tx, actor, consent, request.selections, now)
			await this.recordConsent(tx, actor, consent, request.selections, discards)
			return discards
		})
		await this.binaries.discardBytes(outcome.binaryObjectIds)
		return { consent_id: consent.id, discarded: outcome.discarded, refused: outcome.refused }
	}

	private async discardSelected(
		tx: postgres.TransactionSql,
		actor: AuditActor,
		consent: DraftDiscardConsent,
		selections: readonly DiscardSelection[],
		now: Date,
	): Promise<DraftDiscardOutcome> {
		const selected = await this.selectedDrafts(tx, selections)
		const encounters = await this.lockedEncounters(tx, selected)
		const outcome: DraftDiscardOutcome = { discarded: [], refused: [], binaryObjectIds: [] }
		for (const { selection } of selected) {
			const verdict = await this.verdictOf(tx, consent, selection, encounters)
			if (verdict.refusal !== undefined) {
				outcome.refused.push(verdict.refusal)
				continue
			}
			const { draft, encounter } = verdict
			const binaryObjectIds = await this.removal.removeWithin(tx, actor, draft, encounter, decisionOf(consent), now)
			outcome.discarded.push(draft.id)
			outcome.binaryObjectIds.push(...binaryObjectIds)
		}
		return outcome
	}

	private async selectedDrafts(
		tx: postgres.TransactionSql,
		selections: readonly DiscardSelection[],
	): Promise<SelectedDraft[]> {
		const ordered = [...selections].sort((left, right) => left.acquisitionId.localeCompare(right.acquisitionId))
		const selected: SelectedDraft[] = []
		for (const selection of ordered) {
			selected.push({ selection, draft: await this.acquisitions.findById(tx, selection.acquisitionId) })
		}
		return selected
	}

	// CAP-021-R32
	private async lockedEncounters(
		tx: postgres.TransactionSql,
		selected: readonly SelectedDraft[],
	): Promise<Map<string, EncounterRow>> {
		const encounterIds = [
			...new Set(selected.flatMap(({ draft }) => (draft === undefined ? [] : [draft.encounter_id]))),
		]
		if (encounterIds.length === 0) {
			return new Map()
		}
		const locked = await this.encounters.lockByIds(tx, encounterIds)
		return new Map(locked.map((encounter) => [encounter.id, encounter]))
	}

	// CAP-015-R20, CAP-021-R32
	private async verdictOf(
		tx: postgres.TransactionSql,
		consent: DraftDiscardConsent,
		selection: DiscardSelection,
		encounters: ReadonlyMap<string, EncounterRow>,
	): Promise<DraftVerdict> {
		const acquisitionId = selection.acquisitionId
		const draft = await this.acquisitions.lockById(tx, acquisitionId)
		if (draft === undefined || draft.operator_user_id !== consent.operatorUserId) {
			return { refusal: { acquisition_id: acquisitionId, reason: DRAFT_DISCARD_REFUSAL.NOT_FOUND } }
		}
		if (draft.state !== ACQUISITION_STATE.DRAFT) {
			return { refusal: { acquisition_id: acquisitionId, reason: DRAFT_DISCARD_REFUSAL.CLOSED } }
		}
		const encounter = encounters.get(draft.encounter_id)
		const isUnchanged = await this.administered.isUnchangedSince(tx, acquisitionId, selection.seenUpdatedAt)
		if (encounter === undefined || !isUnchanged) {
			return { refusal: { acquisition_id: acquisitionId, reason: DRAFT_DISCARD_REFUSAL.CHANGED } }
		}
		return { refusal: undefined, draft, encounter }
	}

	// CAP-015-R20, CAP-025-R03, datovy-model.md 4
	private async recordConsent(
		tx: postgres.TransactionSql,
		actor: AuditActor,
		consent: DraftDiscardConsent,
		selections: readonly DiscardSelection[],
		outcome: DraftDiscardOutcome,
	): Promise<void> {
		const counts = { discarded: outcome.discarded.length, refused: outcome.refused.length }
		await this.consents.insert(tx, consent, counts)
		if (counts.discarded > 0) {
			await this.notifications.insertDiscarded(tx, {
				userId: consent.operatorUserId,
				consentId: consent.id,
				discardedCount: counts.discarded,
				discardedAt: consent.grantedAt,
			})
		}
		const selectedIds = selections.map((selection) => selection.acquisitionId)
		await this.audit.append(tx, actor(consentGrantedEventOf(consent, selectedIds, counts)))
	}
}

// CAP-025-R20, CAP-014-R29
function decisionOf(consent: DraftDiscardConsent): DraftDecision {
	return {
		reason: DECISION_REASON.DISCARDED,
		eventType: AUDIT_EVENT_TYPE.DRAFT_ACQUISITION_DISCARD,
		emptiedBy: EMPTIED_BY.ADMINISTRATOR_CONSENT,
		details: (discardedFileCount) => ({
			situation: AUDIT_DISCARD_SITUATION.ADMINISTRATOR_CONSENT,
			discarded_file_count: discardedFileCount,
			draft_discard_consent_id: consent.id,
			reason: consent.reason,
		}),
	}
}
