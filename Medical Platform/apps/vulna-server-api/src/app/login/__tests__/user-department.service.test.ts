import { AUDIT_EVENT_TYPE, DEPARTMENT_ORIGIN } from "@ansora/core-server"
import type postgres from "@veevoy/postgres"
import { describe, expect, it } from "vitest"
import type { AuditRepository } from "../../audit/repositories/audit.repository"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import type { ActorTaskRepository } from "../../clinical-record/repositories/actor-task.repository"
import type { DepartmentRepository } from "../repositories/department.repository"
import { UserDepartmentService } from "../services/user-department.service"

const USER_ID = "22222222-2222-4222-8222-222222222222"
const ADMINISTRATOR_ID = "11111111-1111-4111-8111-111111111111"
const DEPARTMENT_ID = "66666666-6666-4666-8666-666666666666"
const AT = new Date("2026-10-05T09:00:00Z")
const ONCOLOGY = "ONK"
const SURGERY = "CHIR"
const TX = {} as postgres.TransactionSql

interface Move {
	userId: string
	departmentId: string
	at: Date
}

function harnessWith(previous: string | null) {
	const ensured: string[] = []
	const moves: Move[] = []
	const audited: NewAuditEvent[] = []
	const enqueued: string[] = []
	const departments = {
		lockedCodeOf: async () => previous,
		ensure: async (_sql: never, code: string) => {
			ensured.push(code)
			return DEPARTMENT_ID
		},
		moveUser: async (_sql: never, userId: string, departmentId: string, at: Date) => {
			moves.push({ userId, departmentId, at })
		},
	} as unknown as DepartmentRepository
	const audit = {
		append: async (_tx: never, event: NewAuditEvent) => {
			audited.push(event)
			return undefined as never
		},
	} as unknown as AuditRepository
	const actorTasks = {
		enqueue: async (_tx: never, userId: string) => {
			enqueued.push(userId)
		},
	} as unknown as ActorTaskRepository
	return { service: new UserDepartmentService(departments, audit, actorTasks), ensured, moves, audited, enqueued }
}

function changeTo(code: string) {
	return { userId: USER_ID, code, origin: DEPARTMENT_ORIGIN.MANUAL, actorUserId: ADMINISTRATOR_ID, at: AT }
}

describe("UserDepartmentService", () => {
	it("CAP-003-R07 gives the user a first department and records who set it", async () => {
		const { service, ensured, moves, audited } = harnessWith(null)

		await service.assign(TX, changeTo(ONCOLOGY))

		expect(ensured).toEqual([ONCOLOGY])
		expect(moves).toEqual([{ userId: USER_ID, departmentId: DEPARTMENT_ID, at: AT }])
		expect(audited).toEqual([
			expect.objectContaining({
				eventType: AUDIT_EVENT_TYPE.USER_DEPARTMENT_CHANGED,
				actorUserId: ADMINISTRATOR_ID,
				objectId: USER_ID,
				details: { origin: DEPARTMENT_ORIGIN.MANUAL, previous_department: null, department: ONCOLOGY },
			}),
		])
	})

	it("CAP-003-R11 moves the user to another department and records both", async () => {
		const { service, moves, audited } = harnessWith(ONCOLOGY)

		await service.assign(TX, changeTo(SURGERY))

		expect(moves).toHaveLength(1)
		expect(audited).toMatchObject([{ details: { previous_department: ONCOLOGY, department: SURGERY } }])
	})

	it("CAP-001-R31 queues the actor so the new department gets its own PractitionerRole", async () => {
		const { service, enqueued } = harnessWith(ONCOLOGY)

		await service.assign(TX, changeTo(SURGERY))

		expect(enqueued).toEqual([USER_ID])
	})

	it("changes and records nothing when the department stays the same", async () => {
		const { service, ensured, moves, audited, enqueued } = harnessWith(ONCOLOGY)

		await service.assign(TX, changeTo(ONCOLOGY))

		expect(ensured).toEqual([])
		expect(moves).toEqual([])
		expect(audited).toEqual([])
		expect(enqueued).toEqual([])
	})
})
