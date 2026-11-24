import {
	ACQUISITION_KIND,
	ADMINISTRATION_ERROR_CODE,
	DRAFT_DISCARD_REASON,
	DRAFT_DISCARD_REFUSAL,
	EMPTIED_BY,
} from "@ansora/contracts"
import { AUDIT_ACTOR_KIND, AUDIT_EVENT_TYPE, AUDIT_OUTCOME, PERMISSIONS } from "@ansora/core-server"
import { ACQUISITION_STATE } from "@ansora/vulna-domain"
import { HttpStatus } from "@nestjs/common"
import { describe, expect, it } from "vitest"
import type { DatabaseService } from "../../../libs/database/database.service"
import type { AcquisitionDraftRepository } from "../../acquisition/repositories/acquisition-draft.repository"
import type { DraftDecision, DraftRemovalService } from "../../acquisition/services/draft-removal.service"
import type { AcquisitionRow } from "../../acquisition/types/acquisition.types"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import type { AuditRepository } from "../../audit/repositories/audit.repository"
import type { AuditActor, NewAuditEvent } from "../../audit/types/audit.types"
import type { BinaryObjectService } from "../../binary-object/services/binary-object.service"
import type { ConfigurationService } from "../../configuration/services/configuration.service"
import { ENCOUNTER, encounterRow, problemOf } from "../../encounter/__tests__/encounter-fixtures"
import type { EncounterRepository } from "../../encounter/repositories/encounter.repository"
import type { OperatorNotificationRepository } from "../../operator-notification/repositories/operator-notification.repository"
import type { DiscardedDraftsNotification } from "../../operator-notification/types/operator-notification.types"
import type { AdministeredDraftRepository } from "../repositories/administered-draft.repository"
import type { DraftDiscardConsentRepository } from "../repositories/draft-discard-consent.repository"
import type { OperatorPresenceRepository } from "../repositories/operator-presence.repository"
import { DraftDiscardConsentService } from "../services/draft-discard-consent.service"
import type { DraftDiscardCounts, DraftDiscardRequest, OperatorPresenceRow } from "../types/draft-administration.types"

const DAY_SECONDS = 86_400
const ABSENCE_SECONDS = 30 * DAY_SECONDS
const NOW = new Date("2026-10-16T12:00:00.000Z")
const OPERATOR = "11111111-1111-4111-8111-111111111111"
const OTHER_OPERATOR = "22222222-2222-4222-8222-222222222222"
const FIRST = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const SECOND = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const FOREIGN = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const SEEN = "2026-10-01T08:00:00.123456Z"
const CHANGED = "2026-10-02T08:00:00.123456Z"

const ADMINISTRATOR: AdministrationSession = {
	sessionId: "9e8d7c6b-5a49-4382-8170-6f5e4d3c2b1a",
	userId: "3f0d1c2e-5b6a-4c7d-8e9f-0a1b2c3d4e5f",
	permissions: PERMISSIONS,
}

const REVOKED: OperatorPresenceRow = {
	user_id: OPERATOR,
	is_active: false,
	last_login_at: new Date("2026-10-15T08:00:00.000Z"),
	has_active_session: false,
}

function draftRow(id: string, overrides: Partial<AcquisitionRow> = {}): AcquisitionRow {
	return {
		id,
		idempotency_key: id,
		patient_id: "33333333-3333-4333-8333-333333333333",
		encounter_id: ENCOUNTER,
		finding_id: null,
		kind: ACQUISITION_KIND.PHOTO,
		state: ACQUISITION_STATE.DRAFT,
		operator_user_id: OPERATOR,
		department_id: null,
		configuration_version_id: 1,
		started_at: new Date("2026-09-30T08:00:00.000Z"),
		closed_at: null,
		file_count: null,
		version: 1,
		updated_at: new Date("2026-10-01T08:00:00.123Z"),
		...overrides,
	}
}

function request(selections: { id: string; seen: string }[]): DraftDiscardRequest {
	return {
		operatorUserId: OPERATOR,
		reason: DRAFT_DISCARD_REASON.OPERATOR_REVOKED,
		selections: selections.map((selection) => ({ acquisitionId: selection.id, seenUpdatedAt: selection.seen })),
	}
}

interface HarnessOptions {
	presence?: OperatorPresenceRow | undefined
	drafts?: AcquisitionRow[]
	updatedAt?: Record<string, string>
}

function harness(options: HarnessOptions = {}) {
	const drafts = new Map((options.drafts ?? [draftRow(FIRST), draftRow(SECOND)]).map((row) => [row.id, row]))
	const updatedAt = options.updatedAt ?? { [FIRST]: SEEN, [SECOND]: SEEN }
	const removed: { id: string; actor: AuditActor; decision: DraftDecision }[] = []
	const consents: DraftDiscardCounts[] = []
	const notifications: DiscardedDraftsNotification[] = []
	const audits: NewAuditEvent[] = []
	const discardedBytes: string[][] = []
	const database = {
		sql: { begin: async (work: (tx: never) => Promise<unknown>) => await work({} as never) },
	} as unknown as DatabaseService
	const presences = {
		lockPresence: async () => ("presence" in options ? options.presence : REVOKED),
	} as unknown as OperatorPresenceRepository
	const consentRepository = {
		insert: async (_tx: never, _consent: never, counts: DraftDiscardCounts) => {
			consents.push(counts)
		},
	} as unknown as DraftDiscardConsentRepository
	const administered = {
		isUnchangedSince: async (_tx: never, id: string, seen: string) => updatedAt[id] === seen,
	} as unknown as AdministeredDraftRepository
	const acquisitions = {
		findById: async (_tx: never, id: string) => drafts.get(id),
		lockById: async (_tx: never, id: string) => drafts.get(id),
	} as unknown as AcquisitionDraftRepository
	const encounters = {
		lockByIds: async () => [encounterRow()],
	} as unknown as EncounterRepository
	const removal = {
		removeWithin: async (
			_tx: never,
			actor: AuditActor,
			draft: AcquisitionRow,
			_encounter: never,
			decision: DraftDecision,
		) => {
			removed.push({ id: draft.id, actor, decision })
			return [`bytes-of-${draft.id}`]
		},
	} as unknown as DraftRemovalService
	const notificationRepository = {
		insertDiscarded: async (_tx: never, notification: DiscardedDraftsNotification) => {
			notifications.push(notification)
		},
	} as unknown as OperatorNotificationRepository
	const binaries = {
		discardBytes: async (ids: string[]) => {
			discardedBytes.push(ids)
		},
	} as unknown as BinaryObjectService
	const configuration = { integer: async () => ABSENCE_SECONDS } as unknown as ConfigurationService
	const audit = {
		append: async (_tx: never, event: NewAuditEvent) => {
			audits.push(event)
		},
	} as unknown as AuditRepository
	const service = new DraftDiscardConsentService(
		database,
		presences,
		consentRepository,
		administered,
		acquisitions,
		encounters,
		removal,
		notificationRepository,
		binaries,
		configuration,
		audit,
	)
	return { service, removed, consents, notifications, audits, discardedBytes }
}

describe("administrator consent to discard drafts CAP-015-R19, CAP-015-R20", () => {
	it("CAP-015-S18 discards the chosen drafts of a revoked operator at once and audits them with the consent", async () => {
		const run = harness()

		const result = await run.service.grant(
			ADMINISTRATOR,
			request([
				{ id: SECOND, seen: SEEN },
				{ id: FIRST, seen: SEEN },
			]),
			NOW,
		)

		expect(result.discarded).toEqual([FIRST, SECOND])
		expect(result.refused).toEqual([])
		expect(run.removed.map((removal) => removal.decision.emptiedBy)).toEqual([
			EMPTIED_BY.ADMINISTRATOR_CONSENT,
			EMPTIED_BY.ADMINISTRATOR_CONSENT,
		])
		expect(run.removed[0]?.decision.details(2)).toEqual({
			situation: "administrator_consent",
			discarded_file_count: 2,
			draft_discard_consent_id: result.consent_id,
			reason: DRAFT_DISCARD_REASON.OPERATOR_REVOKED,
		})
		const discardEvent = run.removed[0]?.actor({
			eventType: AUDIT_EVENT_TYPE.DRAFT_ACQUISITION_DISCARD,
			outcome: AUDIT_OUTCOME.SUCCESS,
			details: {},
		})
		expect(discardEvent?.actorKind).toBe(AUDIT_ACTOR_KIND.USER)
		expect(discardEvent?.actorUserId).toBe(ADMINISTRATOR.userId)
		expect(discardEvent?.actorDeviceId).toBeUndefined()
		expect(run.consents).toEqual([{ discarded: 2, refused: 0 }])
		expect(run.audits).toEqual([
			{
				eventType: AUDIT_EVENT_TYPE.DRAFT_DISCARD_CONSENT_GRANTED,
				actorKind: AUDIT_ACTOR_KIND.USER,
				actorUserId: ADMINISTRATOR.userId,
				objectId: result.consent_id,
				outcome: AUDIT_OUTCOME.SUCCESS,
				details: {
					draft_discard_consent_id: result.consent_id,
					operator_user_id: OPERATOR,
					administrator_user_id: ADMINISTRATOR.userId,
					reason: DRAFT_DISCARD_REASON.OPERATOR_REVOKED,
					acquisition_ids: [SECOND, FIRST],
					discarded_count: 2,
					refused_count: 0,
				},
			},
		])
		expect(run.discardedBytes).toEqual([[`bytes-of-${FIRST}`, `bytes-of-${SECOND}`]])
	})

	it("CAP-015-S23 leaves the operator a notification with the count and time and no patient", async () => {
		const run = harness()

		const result = await run.service.grant(ADMINISTRATOR, request([{ id: FIRST, seen: SEEN }]), NOW)

		expect(run.notifications).toEqual([
			{ userId: OPERATOR, consentId: result.consent_id, discardedCount: 1, discardedAt: NOW },
		])
	})

	it("CAP-015-S20 refuses the consent for an operator who logged in recently and writes nothing", async () => {
		const run = harness({
			presence: {
				user_id: OPERATOR,
				is_active: true,
				last_login_at: new Date(NOW.getTime() - 5 * DAY_SECONDS * 1000),
				has_active_session: false,
			},
		})

		const problem = await problemOf(run.service.grant(ADMINISTRATOR, request([{ id: FIRST, seen: SEEN }]), NOW))

		expect(problem.getStatus()).toBe(HttpStatus.CONFLICT)
		expect(problem.code).toBe(ADMINISTRATION_ERROR_CODE.DRAFT_DISCARD_NOT_ALLOWED)
		expect(run.removed).toEqual([])
		expect(run.consents).toEqual([])
		expect(run.audits).toEqual([])
	})

	it("answers not-found for an operator who does not exist", async () => {
		const run = harness({ presence: undefined })

		const problem = await problemOf(run.service.grant(ADMINISTRATOR, request([{ id: FIRST, seen: SEEN }]), NOW))

		expect(problem.getStatus()).toBe(HttpStatus.NOT_FOUND)
		expect(run.audits).toEqual([])
	})

	it("CAP-015-R20 keeps a draft the operator changed, closed, or that is not theirs", async () => {
		const run = harness({
			drafts: [
				draftRow(FIRST),
				draftRow(SECOND, { state: ACQUISITION_STATE.RECEIVED }),
				draftRow(FOREIGN, { operator_user_id: OTHER_OPERATOR }),
			],
			updatedAt: { [FIRST]: CHANGED, [SECOND]: SEEN, [FOREIGN]: SEEN },
		})

		const result = await run.service.grant(
			ADMINISTRATOR,
			request([
				{ id: FIRST, seen: SEEN },
				{ id: SECOND, seen: SEEN },
				{ id: FOREIGN, seen: SEEN },
			]),
			NOW,
		)

		expect(result.discarded).toEqual([])
		expect(result.refused).toEqual([
			{ acquisition_id: FIRST, reason: DRAFT_DISCARD_REFUSAL.CHANGED },
			{ acquisition_id: SECOND, reason: DRAFT_DISCARD_REFUSAL.CLOSED },
			{ acquisition_id: FOREIGN, reason: DRAFT_DISCARD_REFUSAL.NOT_FOUND },
		])
		expect(run.removed).toEqual([])
		expect(run.consents).toEqual([{ discarded: 0, refused: 3 }])
		expect(run.notifications).toEqual([])
		expect(run.audits).toHaveLength(1)
	})
})
