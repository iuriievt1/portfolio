import { ADMINISTRATION_ERROR_CODE, ADMINISTRATOR_ALERT_KIND } from "@ansora/contracts"
import { AUDIT_ACTOR_KIND, AUDIT_EVENT_TYPE, AUDIT_OUTCOME, PERMISSION } from "@ansora/core-server"
import { HttpStatus } from "@nestjs/common"
import { describe, expect, it } from "vitest"
import type { DatabaseService } from "../../../libs/database/database.service"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import type { AuditRepository } from "../../audit/repositories/audit.repository"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import type { BinaryObjectService } from "../../binary-object/services/binary-object.service"
import type { ConfigurationService } from "../../configuration/services/configuration.service"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import type { AdministratorAlertRepository } from "../../monitoring/repositories/administrator-alert.repository"
import type { OrphanedObjectRepository } from "../repositories/orphaned-object.repository"
import { OrphanedObjectService } from "../services/orphaned-object.service"
import type { LockedObjectRow, OrphanedObjectRow } from "../types/orphaned-object.types"

const OBJECT_ID = "6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d"
const REASON = "Zbytek po přerušeném nahrávání"
const SET_ASIDE_AT = new Date("2026-11-11T09:00:00.000Z")
const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 200

const ADMINISTRATOR: AdministrationSession = {
	sessionId: "7b8c9d0e-1f2a-4b3c-8d4e-5f6a7b8c9d0e",
	userId: "8c9d0e1f-2a3b-4c4d-8e5f-6a7b8c9d0e1f",
	permissions: [PERMISSION.ADMINISTRATION_ACCESS, PERMISSION.MONITORING_MANAGE],
}

const SET_ASIDE: LockedObjectRow = { id: OBJECT_ID, set_aside_at: SET_ASIDE_AT, is_unreferenced: true }

interface Run {
	service: OrphanedObjectService
	steps: string[]
	events: NewAuditEvent[]
}

interface Situation {
	locked?: LockedObjectRow | undefined
	isAnyLeft?: boolean
	page?: OrphanedObjectRow[]
}

function runOf(situation: Situation): Run {
	const steps: string[] = []
	const events: NewAuditEvent[] = []
	const database = {
		sql: {
			begin: async (work: (tx: unknown) => Promise<unknown>) => {
				const result = await work({})
				steps.push("commit")
				return result
			},
		},
	} as unknown as DatabaseService
	const configuration = {
		pageSize: async () => ({ defaultSize: DEFAULT_PAGE_SIZE, maxSize: MAX_PAGE_SIZE }),
	} as unknown as ConfigurationService
	const objects = {
		page: async () => ({ rows: situation.page ?? [], nextCursor: null }),
		locked: async () => situation.locked,
		delete: async (_tx: unknown, objectId: string) => {
			steps.push(`delete ${objectId}`)
		},
		isAnySetAside: async () => situation.isAnyLeft ?? false,
	} as unknown as OrphanedObjectRepository
	const alerts = {
		resolveAllOf: async (_tx: unknown, kind: string) => {
			steps.push(`resolve ${kind}`)
		},
	} as unknown as AdministratorAlertRepository
	const audit = {
		append: async (_tx: unknown, event: NewAuditEvent) => {
			steps.push(`audit ${event.eventType}`)
			events.push(event)
		},
	} as unknown as AuditRepository
	const binaries = {
		discardBytes: async (ids: readonly string[]) => {
			steps.push(`discard ${ids.join(",")}`)
		},
	} as unknown as BinaryObjectService
	return {
		service: new OrphanedObjectService(database, configuration, objects, alerts, audit, binaries),
		steps,
		events,
	}
}

async function problemOf(pending: Promise<unknown>): Promise<ProblemException> {
	const error = await pending.catch((caught: unknown) => caught)
	if (!(error instanceof ProblemException)) {
		throw new Error("the operation did not fail with a problem")
	}
	return error
}

describe("deleting a set-aside orphaned object CAP-026-S08", () => {
	it("CAP-026-S08 audits the deletion, deletes the row and only after the commit the bytes", async () => {
		const run = runOf({ locked: SET_ASIDE, isAnyLeft: true })

		await run.service.delete(OBJECT_ID, { reason: REASON }, ADMINISTRATOR)

		expect(run.steps).toEqual([
			`audit ${AUDIT_EVENT_TYPE.ORPHANED_OBJECT_DELETION}`,
			`delete ${OBJECT_ID}`,
			"commit",
			`discard ${OBJECT_ID}`,
		])
		expect(run.events).toEqual([
			{
				eventType: AUDIT_EVENT_TYPE.ORPHANED_OBJECT_DELETION,
				actorKind: AUDIT_ACTOR_KIND.USER,
				actorUserId: ADMINISTRATOR.userId,
				objectId: OBJECT_ID,
				outcome: AUDIT_OUTCOME.SUCCESS,
				details: { binary_object_id: OBJECT_ID, reason: REASON, administrator_user_id: ADMINISTRATOR.userId },
			},
		])
	})

	it("CAP-026-R14 ends the alerts once no set-aside object is left", async () => {
		const run = runOf({ locked: SET_ASIDE, isAnyLeft: false })

		await run.service.delete(OBJECT_ID, { reason: REASON }, ADMINISTRATOR)

		expect(run.steps).toContain(`resolve ${ADMINISTRATOR_ALERT_KIND.ORPHANED_OBJECTS_SET_ASIDE}`)
	})

	it("CAP-026-R14 answers HTTP 404 for an object that does not exist and touches nothing", async () => {
		const run = runOf({ locked: undefined })

		const problem = await problemOf(run.service.delete(OBJECT_ID, { reason: REASON }, ADMINISTRATOR))

		expect(problem.getStatus()).toBe(HttpStatus.NOT_FOUND)
		expect(problem.code).toBe(ADMINISTRATION_ERROR_CODE.NOT_FOUND)
		expect(run.steps).toEqual([])
	})

	it.each([
		["the cleanup has not set aside", { ...SET_ASIDE, set_aside_at: null }],
		["a record refers to again", { ...SET_ASIDE, is_unreferenced: false }],
	])("CAP-026-R14 refuses an object %s and touches nothing", async (_situation, locked) => {
		const run = runOf({ locked })

		const problem = await problemOf(run.service.delete(OBJECT_ID, { reason: REASON }, ADMINISTRATOR))

		expect(problem.getStatus()).toBe(HttpStatus.CONFLICT)
		expect(problem.code).toBe(ADMINISTRATION_ERROR_CODE.ORPHANED_OBJECT_NOT_SET_ASIDE)
		expect(run.steps).toEqual([])
	})
})

describe("listing the set-aside orphaned objects CAP-026-S07", () => {
	it("administration.yaml OrphanedObject hands over the metadata of the object only", async () => {
		const row: OrphanedObjectRow = {
			id: OBJECT_ID,
			size_bytes: "2048",
			sha256: "d".repeat(64),
			created_at: new Date("2026-11-10T08:00:00.000Z"),
			set_aside_at: SET_ASIDE_AT,
			cursor_moment: "2026-11-10T08:00:00.000000Z",
		}

		expect(await runOf({ page: [row] }).service.list({})).toEqual({
			items: [
				{
					id: OBJECT_ID,
					size_bytes: 2048,
					sha256: "d".repeat(64),
					created_at: "2026-11-10T08:00:00.000Z",
					set_aside_at: "2026-11-11T09:00:00.000Z",
				},
			],
			next_cursor: null,
		})
	})
})
