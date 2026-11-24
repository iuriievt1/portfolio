import { ADMINISTRATION_ERROR_CODE, CARRIER_STATE, USER_STATE } from "@ansora/contracts"
import {
	AUDIT_EVENT_TYPE,
	DEPARTMENT_ORIGIN,
	PERMISSIONS,
	ROLE,
	ROLE_ORIGIN,
	type Role,
	type RoleOrigin,
} from "@ansora/core-server"
import { HttpStatus } from "@nestjs/common"
import { describe, expect, it } from "vitest"
import type { DatabaseService } from "../../../libs/database/database.service"
import type { QrCodeKeyService } from "../../../libs/qr-code/qr-code-key.service"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import type { AuditRepository } from "../../audit/repositories/audit.repository"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import type { ActorTaskRepository } from "../../clinical-record/repositories/actor-task.repository"
import type { ConfigurationService } from "../../configuration/services/configuration.service"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import type { AppUserRepository } from "../repositories/app-user.repository"
import type { CardRepository } from "../repositories/card.repository"
import type { DepartmentRepository } from "../repositories/department.repository"
import type { RoleRepository } from "../repositories/role.repository"
import { CarrierRevocationService } from "../services/carrier-revocation.service"
import type { LoginPolicyService } from "../services/login-policy.service"
import { UserAdministrationService } from "../services/user-administration.service"
import type { UserDepartmentService } from "../services/user-department.service"
import type { DepartmentChange } from "../types/department.types"
import type { AppUser } from "../types/login.types"
import type { NewQrCode, RoleRow } from "../types/user-administration.types"

const ADMINISTRATOR: AdministrationSession = {
	sessionId: "99999999-9999-4999-8999-999999999999",
	userId: "11111111-1111-4111-8111-111111111111",
	permissions: PERMISSIONS,
}
const USER_ID = "22222222-2222-4222-8222-222222222222"
const QR_CODE_ID = "33333333-3333-4333-8333-333333333333"
const UNKNOWN_USER_ID = "44444444-4444-4444-8444-444444444444"
const DEPARTMENT = "ONK"
const ISSUED_AT = new Date("2026-10-01T08:00:00Z")
const SIGNED = {
	identifier: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
	keyVersion: 2,
	content: "VULNA1.2.ABCDEFGHIJKLMNOPQRSTUVWXYZ.SIG",
}

function userRow(overrides: Partial<AppUser> = {}): AppUser {
	return {
		id: USER_ID,
		displayName: "Jana Nováková",
		personalNumber: "004211",
		isActive: true,
		loginName: null,
		email: null,
		preferredLanguage: null,
		...overrides,
	}
}

const ROLE_ROWS: RoleRow[] = [
	{ code: ROLE.ADMINISTRATOR, name: "Správce" },
	{ code: ROLE.CLINICIAN, name: "Zdravotník" },
]

interface ReplacedRoles {
	origin: RoleOrigin
	roles: readonly Role[]
}

interface Harness {
	service: UserAdministrationService
	audited: NewAuditEvent[]
	inserted: NewQrCode[]
	replaced: ReplacedRoles[]
	assigned: DepartmentChange[]
	enqueued: string[]
}

interface Options {
	hasMore?: boolean
	previousQrCodes?: string[]
	manualRoles?: Role[]
	roleRows?: RoleRow[]
	department?: string
	departmentClaim?: string
}

function harnessWith(row: AppUser, options: Options = {}): Harness {
	const audited: NewAuditEvent[] = []
	const inserted: NewQrCode[] = []
	const replaced: ReplacedRoles[] = []
	const assigned: DepartmentChange[] = []
	const enqueued: string[] = []
	let department = options.department
	const userRoles = [
		{ role: ROLE.CLINICIAN, origin: ROLE_ORIGIN.GROUP },
		...(options.manualRoles ?? []).map((role) => ({ role, origin: ROLE_ORIGIN.MANUAL })),
	]
	const users = {
		page: async () => ({ users: [row], hasMore: options.hasMore ?? false }),
		findById: async (id: string) => (id === row.id ? row : undefined),
		lockActive: async () => row.isActive,
		rolesOfUsers: async () => userRoles.map((userRole) => ({ user_id: row.id, ...userRole })),
		rolesOf: async () => userRoles,
		replaceRoles: async (_tx: never, _userId: string, origin: RoleOrigin, roles: readonly Role[]) => {
			replaced.push({ origin, roles })
		},
	} as unknown as AppUserRepository
	const roleRepository = { list: async () => options.roleRows ?? ROLE_ROWS } as unknown as RoleRepository
	const departments = {
		codesOfUsers: async () => new Map(department === undefined ? [] : [[row.id, department]]),
	} as unknown as DepartmentRepository
	const userDepartments = {
		assign: async (_tx: never, change: DepartmentChange) => {
			assigned.push(change)
			department = change.code
		},
	} as unknown as UserDepartmentService
	const loginPolicy = {
		current: async () => ({ departmentClaim: options.departmentClaim }),
	} as unknown as LoginPolicyService
	const cards = {
		cardsOf: async () => [
			{ id: "c1", short_uid: "…A1B2", bound_at: ISSUED_AT, revoked_at: null },
			{ id: "c2", short_uid: "…C3D4", bound_at: ISSUED_AT, revoked_at: ISSUED_AT },
		],
		revokeQrCodesOf: async () => options.previousQrCodes ?? [],
		qrCodesOf: async () => [
			{ id: QR_CODE_ID, issued_at: ISSUED_AT, revoked_at: null },
			{ id: "q2", issued_at: ISSUED_AT, revoked_at: ISSUED_AT },
		],
		insertQrCode: async (_tx: never, next: NewQrCode) => {
			inserted.push(next)
			return { id: QR_CODE_ID, issued_at: ISSUED_AT }
		},
	} as unknown as CardRepository
	const qrKeys = { issue: () => SIGNED } as unknown as QrCodeKeyService
	const database = {
		sql: { begin: async (work: (tx: never) => Promise<unknown>) => work({} as never) },
	} as unknown as DatabaseService
	const audit = {
		append: async (_tx: never, event: NewAuditEvent) => {
			audited.push(event)
			return undefined as never
		},
	} as unknown as AuditRepository
	const configuration = {
		pageSize: async () => ({ defaultSize: 100, maxSize: 500 }),
	} as unknown as ConfigurationService
	const actorTasks = {
		enqueue: async (_tx: never, userId: string) => {
			enqueued.push(userId)
		},
	} as unknown as ActorTaskRepository
	return {
		service: new UserAdministrationService(
			database,
			users,
			roleRepository,
			departments,
			userDepartments,
			loginPolicy,
			cards,
			qrKeys,
			audit,
			configuration,
			actorTasks,
			new CarrierRevocationService(database, cards, audit),
		),
		audited,
		inserted,
		replaced,
		assigned,
		enqueued,
	}
}

describe("UserAdministrationService", () => {
	it("lists users with their roles and a cursor only when another page follows", async () => {
		const first = await harnessWith(userRow(), { hasMore: true, manualRoles: [ROLE.ADMINISTRATOR] }).service.list({
			limit: 1,
			cursor: undefined,
			search: undefined,
		})
		const last = await harnessWith(userRow()).service.list({ limit: 1, cursor: undefined, search: undefined })

		expect(first.items).toEqual([
			{
				id: USER_ID,
				display_name: "Jana Nováková",
				personal_number: "004211",
				login_name: null,
				email: null,
				department: null,
				department_from_directory: false,
				roles: [ROLE.ADMINISTRATOR, ROLE.CLINICIAN],
				group_roles: [ROLE.CLINICIAN],
				manual_roles: [ROLE.ADMINISTRATOR],
				state: USER_STATE.ACTIVE,
			},
		])
		expect(first.next_cursor).toEqual(expect.any(String))
		expect(last.next_cursor).toBeNull()
	})

	it("shows the login name and the e-mail the directory gave at the last full login", async () => {
		const { service } = harnessWith(userRow({ loginName: "jnovakova", email: "jana.novakova@mou.invalid" }))

		expect(await service.detail(USER_ID)).toMatchObject({
			login_name: "jnovakova",
			email: "jana.novakova@mou.invalid",
		})
	})

	it("shows a deactivated account as revoked and cards by the state of their binding", async () => {
		const { service } = harnessWith(userRow({ isActive: false }))

		expect((await service.detail(USER_ID)).state).toBe(USER_STATE.REVOKED)
		expect((await service.cardsOf(USER_ID)).map((card) => card.state)).toEqual([
			CARRIER_STATE.VALID,
			CARRIER_STATE.REVOKED,
		])
	})

	it("CAP-005-S02 issues a signed QR code to print and records who issued it", async () => {
		const { service, audited, inserted } = harnessWith(userRow())

		const issued = await service.issueQrCode(USER_ID, ADMINISTRATOR)

		expect(issued).toEqual({
			id: QR_CODE_ID,
			issued_at: ISSUED_AT.toISOString(),
			state: CARRIER_STATE.VALID,
			print_content: SIGNED.content,
		})
		expect(inserted).toMatchObject([
			{ userId: USER_ID, identifier: SIGNED.identifier, keyVersion: 2, issuedByUserId: ADMINISTRATOR.userId },
		])
		expect(audited).toMatchObject([
			{
				eventType: AUDIT_EVENT_TYPE.QR_CODE_ISSUED,
				actorUserId: ADMINISTRATOR.userId,
				objectId: QR_CODE_ID,
				details: { user_id: USER_ID, key_version: 2 },
			},
		])
	})

	it("CAP-005-S03 replaces the user's valid QR code and records both changes", async () => {
		const previous = "55555555-5555-4555-8555-555555555555"
		const { service, audited } = harnessWith(userRow(), { previousQrCodes: [previous] })

		await service.issueQrCode(USER_ID, ADMINISTRATOR)

		expect(audited).toMatchObject([
			{ eventType: AUDIT_EVENT_TYPE.QR_CODE_REVOCATION, objectId: previous, details: { user_id: USER_ID } },
			{ eventType: AUDIT_EVENT_TYPE.QR_CODE_ISSUED, objectId: QR_CODE_ID },
		])
	})

	it("lists the QR codes of the user by their state and without the content to print", async () => {
		const { service } = harnessWith(userRow())

		expect(await service.qrCodesOf(USER_ID)).toEqual([
			{ id: QR_CODE_ID, issued_at: ISSUED_AT.toISOString(), state: CARRIER_STATE.VALID },
			{ id: "q2", issued_at: ISSUED_AT.toISOString(), state: CARRIER_STATE.REVOKED },
		])
	})

	it("refuses the QR codes of an unknown user", async () => {
		const refusal = await harnessWith(userRow())
			.service.qrCodesOf(UNKNOWN_USER_ID)
			.catch((error: unknown) => error)

		expect((refusal as ProblemException).code).toBe(ADMINISTRATION_ERROR_CODE.NOT_FOUND)
	})

	it("CAP-005-S05 refuses a QR code to a user without an active account", async () => {
		const { service, audited, inserted } = harnessWith(userRow({ isActive: false }))

		const refusal = await service.issueQrCode(USER_ID, ADMINISTRATOR).catch((error: unknown) => error)

		expect(refusal).toBeInstanceOf(ProblemException)
		expect((refusal as ProblemException).code).toBe(ADMINISTRATION_ERROR_CODE.RECORD_REJECTED)
		expect(inserted).toEqual([])
		expect(audited).toEqual([])
	})

	it("refuses an unknown user", async () => {
		const refusal = await harnessWith(userRow())
			.service.detail(UNKNOWN_USER_ID)
			.catch((error: unknown) => error)

		expect((refusal as ProblemException).code).toBe(ADMINISTRATION_ERROR_CODE.NOT_FOUND)
	})

	it("CAP-003-R03 tells the roles from the directory groups apart from the manual ones", async () => {
		const { service } = harnessWith(userRow(), { manualRoles: [ROLE.ADMINISTRATOR, ROLE.CLINICIAN] })

		expect(await service.detail(USER_ID)).toMatchObject({
			roles: [ROLE.ADMINISTRATOR, ROLE.CLINICIAN],
			group_roles: [ROLE.CLINICIAN],
			manual_roles: [ROLE.ADMINISTRATOR, ROLE.CLINICIAN],
		})
	})

	it("lists the roles with their names", async () => {
		expect(await harnessWith(userRow()).service.listRoles()).toEqual(ROLE_ROWS)
	})

	it("fails rather than list a role the contract does not know", async () => {
		const { service } = harnessWith(userRow(), { roleRows: [{ code: "auditor", name: "Auditor" }] })
		await expect(service.listRoles()).rejects.toThrow("role auditor is outside the roles of the contract")
	})

	it("CAP-003-S02 assigns a manual role and records who assigned it", async () => {
		const { service, audited, replaced } = harnessWith(userRow())

		await service.setManualRoles(USER_ID, [ROLE.ADMINISTRATOR], ADMINISTRATOR)

		expect(replaced).toEqual([{ origin: ROLE_ORIGIN.MANUAL, roles: [ROLE.ADMINISTRATOR] }])
		expect(audited).toEqual([
			expect.objectContaining({
				eventType: AUDIT_EVENT_TYPE.USER_ROLES_CHANGED,
				actorUserId: ADMINISTRATOR.userId,
				objectId: USER_ID,
				details: { origin: ROLE_ORIGIN.MANUAL, previous_roles: [], roles: [ROLE.ADMINISTRATOR] },
			}),
		])
	})

	it("ADR-053 bod 6 queues the actor so the store membership follows the new role", async () => {
		const { service, enqueued } = harnessWith(userRow())

		await service.setManualRoles(USER_ID, [ROLE.ADMINISTRATOR], ADMINISTRATOR)

		expect(enqueued).toEqual([USER_ID])
	})

	it("CAP-003-S07 removes only the manual role and leaves the role from the group", async () => {
		const { service, audited, replaced } = harnessWith(userRow(), { manualRoles: [ROLE.ADMINISTRATOR] })

		await service.setManualRoles(USER_ID, [], ADMINISTRATOR)

		expect(replaced).toEqual([{ origin: ROLE_ORIGIN.MANUAL, roles: [] }])
		expect(audited).toMatchObject([{ details: { previous_roles: [ROLE.ADMINISTRATOR], roles: [] } }])
	})

	it("changes and records nothing when the manual roles stay the same", async () => {
		const { service, audited, replaced } = harnessWith(userRow(), { manualRoles: [ROLE.CLINICIAN] })

		await service.setManualRoles(USER_ID, [ROLE.CLINICIAN], ADMINISTRATOR)

		expect(replaced).toEqual([])
		expect(audited).toEqual([])
	})

	it("refuses roles for an unknown user", async () => {
		const refusal = await harnessWith(userRow())
			.service.setManualRoles(UNKNOWN_USER_ID, [ROLE.CLINICIAN], ADMINISTRATOR)
			.catch((error: unknown) => error)

		expect((refusal as ProblemException).code).toBe(ADMINISTRATION_ERROR_CODE.NOT_FOUND)
	})

	it("lists the department of each user", async () => {
		const page = await harnessWith(userRow(), { department: DEPARTMENT }).service.list({
			limit: 1,
			cursor: undefined,
			search: undefined,
		})

		expect(page.items?.[0]?.department).toBe(DEPARTMENT)
	})

	it("CAP-003-R07 sets the department by hand while the directory names none", async () => {
		const { service, assigned } = harnessWith(userRow())

		const user = await service.setDepartment(USER_ID, DEPARTMENT, ADMINISTRATOR)

		expect(assigned).toEqual([
			{
				userId: USER_ID,
				code: DEPARTMENT,
				origin: DEPARTMENT_ORIGIN.MANUAL,
				actorUserId: ADMINISTRATOR.userId,
				at: expect.any(Date),
			},
		])
		expect(user.department).toBe(DEPARTMENT)
	})

	it("CAP-003-R07 tells the administration the department comes from the directory", async () => {
		const manual = await harnessWith(userRow()).service.detail(USER_ID)
		const fromDirectory = await harnessWith(userRow(), { departmentClaim: "department" }).service.detail(USER_ID)

		expect(manual.department_from_directory).toBe(false)
		expect(fromDirectory.department_from_directory).toBe(true)
	})

	it("CAP-003-R07 refuses a manual department once the directory provides it", async () => {
		const { service, assigned } = harnessWith(userRow(), { departmentClaim: "department" })

		const refusal = await service.setDepartment(USER_ID, DEPARTMENT, ADMINISTRATOR).catch((error: unknown) => error)

		expect(refusal).toBeInstanceOf(ProblemException)
		expect((refusal as ProblemException).getStatus()).toBe(HttpStatus.CONFLICT)
		expect((refusal as ProblemException).code).toBe(ADMINISTRATION_ERROR_CODE.DEPARTMENT_FROM_DIRECTORY)
		expect(assigned).toEqual([])
	})

	it("refuses a department for an unknown user", async () => {
		const { service, assigned } = harnessWith(userRow())

		const refusal = await service
			.setDepartment(UNKNOWN_USER_ID, DEPARTMENT, ADMINISTRATOR)
			.catch((error: unknown) => error)

		expect((refusal as ProblemException).code).toBe(ADMINISTRATION_ERROR_CODE.NOT_FOUND)
		expect(assigned).toEqual([])
	})
})
