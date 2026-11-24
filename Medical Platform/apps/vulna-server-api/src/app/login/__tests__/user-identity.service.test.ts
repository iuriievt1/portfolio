import {
	type AuthenticatedIdentity,
	DEPARTMENT_ORIGIN,
	type IdentityProviderPort,
	MILLISECONDS_PER_SECOND,
	PERMISSION,
} from "@ansora/core-server"
import type postgres from "@veevoy/postgres"
import { describe, expect, it } from "vitest"
import type { DatabaseService, Executor } from "../../../libs/database/database.service"
import type { AuditRepository } from "../../audit/repositories/audit.repository"
import type { ActorTaskRepository } from "../../clinical-record/repositories/actor-task.repository"
import { OUTSIDE_AUTHORIZED_GROUP } from "../constants/login-failure.constants"
import type { AppUserRepository } from "../repositories/app-user.repository"
import type { UserDepartmentService } from "../services/user-department.service"
import { UserIdentityService } from "../services/user-identity.service"
import type { DepartmentChange } from "../types/department.types"
import type { AppUser, DirectoryAccount } from "../types/login.types"
import type { LoginPolicy } from "../types/login-policy.types"

const USER_ID = "11111111-1111-4111-8111-111111111111"
const SQL = {} as Executor
const AUTHORIZED_GROUP = "vulna-users"
const USER_NAME = "Jana Nováková"
const USER = { id: USER_ID, isActive: true, displayName: USER_NAME } as AppUser
const POLICY = { groupClaim: "groups", authorizedGroup: AUTHORIZED_GROUP, groupToRole: [] } as unknown as LoginPolicy
const NO_ACTOR_TASKS = {} as ActorTaskRepository

function actorTasksInto(enqueued: string[]): ActorTaskRepository {
	return {
		enqueue: async (_tx: never, userId: string) => {
			enqueued.push(userId)
		},
	} as unknown as ActorTaskRepository
}

function serviceGranting(permissions: string[]): UserIdentityService {
	const users = { permissionsOf: async () => permissions } as unknown as AppUserRepository
	return new UserIdentityService(
		{} as DatabaseService,
		users,
		{} as AuditRepository,
		{} as UserDepartmentService,
		NO_ACTOR_TASKS,
		{} as unknown as IdentityProviderPort,
	)
}

function identityIn(groups: string[]): AuthenticatedIdentity {
	return {
		subjectId: "subject",
		displayName: "Jana Nováková",
		givenName: undefined,
		familyName: undefined,
		authTime: Math.floor(Date.now() / MILLISECONDS_PER_SECOND),
		claims: { groups },
		refreshToken: undefined,
	}
}

function serviceRefreshing(refreshed: AuthenticatedIdentity | undefined, storedGroups: string[]): UserIdentityService {
	const users = {
		identityOfUser: async () => ({ id: "identity-1", userId: USER_ID, refreshToken: "refresh", groups: storedGroups }),
		saveRefreshedIdentity: async () => undefined,
		rolesOf: async () => [],
	} as unknown as AppUserRepository
	const provider = {
		refresh: async () => ({ ok: true, refreshed: { refreshToken: "next", identity: refreshed } }),
	} as unknown as IdentityProviderPort
	const database = {
		sql: { begin: async (work: (tx: never) => Promise<unknown>) => await work({} as never) },
	} as unknown as DatabaseService
	return new UserIdentityService(
		database,
		users,
		{} as AuditRepository,
		{} as UserDepartmentService,
		NO_ACTOR_TASKS,
		provider,
	)
}

function serviceEstablishing(
	assigned: DepartmentChange[],
	enqueued: string[] = [],
	previousName: string | null = USER_NAME,
	accounts: DirectoryAccount[] = [],
): UserIdentityService {
	const users = {
		findIdentity: async () => (previousName === null ? undefined : { id: "identity-1", userId: USER_ID }),
		findById: async () => ({ ...USER, displayName: previousName }),
		establish: async (
			_sql: never,
			_issuer: string,
			_identity: never,
			_personalNumber: string,
			account: DirectoryAccount,
		) => {
			accounts.push(account)
			return USER
		},
		rolesOf: async () => [],
	} as unknown as AppUserRepository
	const userDepartments = {
		assign: async (_tx: never, change: DepartmentChange) => {
			assigned.push(change)
		},
	} as unknown as UserDepartmentService
	const provider = { issuer: () => "https://idp.example" } as unknown as IdentityProviderPort
	return new UserIdentityService(
		{} as DatabaseService,
		users,
		{} as AuditRepository,
		userDepartments,
		actorTasksInto(enqueued),
		provider,
	)
}

describe("UserIdentityService.permissionsOf", () => {
	it("returns the permissions the user's roles grant", async () => {
		const granted = [PERMISSION.ADMINISTRATION_ACCESS, PERMISSION.USERS_MANAGE]
		expect(await serviceGranting(granted).permissionsOf(SQL, USER_ID)).toEqual(granted)
	})

	it("fails rather than grant a permission the catalog does not know", async () => {
		await expect(serviceGranting(["audit.delete"]).permissionsOf(SQL, USER_ID)).rejects.toThrow(
			`user ${USER_ID} holds permission audit.delete, which the catalog does not know`,
		)
	})
})

describe("UserIdentityService.confirmWithProvider", () => {
	it("confirms a user who stays in the authorized group", async () => {
		const service = serviceRefreshing(identityIn([AUTHORIZED_GROUP]), [AUTHORIZED_GROUP])
		expect(await service.confirmWithProvider(USER, POLICY, new Date())).toEqual({ ok: true })
	})

	it("CAP-003-S09 refuses a user the customer took out of the authorized group", async () => {
		const service = serviceRefreshing(identityIn(["vulna-clinicians"]), [AUTHORIZED_GROUP])
		expect(await service.confirmWithProvider(USER, POLICY, new Date())).toEqual({
			ok: false,
			failure: OUTSIDE_AUTHORIZED_GROUP,
		})
	})

	it("judges by the last known groups when the provider sends none on refresh", async () => {
		const outside = serviceRefreshing(undefined, ["vulna-clinicians"])
		const inside = serviceRefreshing(undefined, [AUTHORIZED_GROUP])
		expect(await outside.confirmWithProvider(USER, POLICY, new Date())).toMatchObject({ ok: false })
		expect(await inside.confirmWithProvider(USER, POLICY, new Date())).toEqual({ ok: true })
	})

	it("refuses everyone while the installation names no authorized group", async () => {
		const service = serviceRefreshing(identityIn([AUTHORIZED_GROUP]), [AUTHORIZED_GROUP])
		const unset = { ...POLICY, authorizedGroup: undefined }
		expect(await service.confirmWithProvider(USER, unset, new Date())).toMatchObject({ ok: false })
	})
})

describe("UserIdentityService.establish", () => {
	const TX = {} as postgres.TransactionSql
	const NOW = new Date("2026-10-05T09:00:00Z")
	const WITH_CLAIM = { ...POLICY, departmentClaim: "department" }
	const LOGIN_NAME_CLAIM = "preferred_username"
	const EMAIL_CLAIM = "email"
	const EMAIL = "jana.novakova@mou.invalid"
	const WITH_ACCOUNT_CLAIMS = { ...POLICY, loginNameClaim: LOGIN_NAME_CLAIM, emailClaim: EMAIL_CLAIM }

	function identityWith(claims: Record<string, unknown>): AuthenticatedIdentity {
		return { ...identityIn([AUTHORIZED_GROUP]), claims: { groups: [AUTHORIZED_GROUP], ...claims } }
	}

	it("CAP-001-R31 takes the department from the directory at a full login", async () => {
		const assigned: DepartmentChange[] = []

		await serviceEstablishing(assigned).establish(TX, identityWith({ department: " ONK " }), "004211", WITH_CLAIM, NOW)

		expect(assigned).toEqual([
			{ userId: USER_ID, code: "ONK", origin: DEPARTMENT_ORIGIN.DIRECTORY, actorUserId: USER_ID, at: NOW },
		])
	})

	it("keeps the last known department when the directory sends none", async () => {
		const assigned: DepartmentChange[] = []

		await serviceEstablishing(assigned).establish(TX, identityWith({}), "004211", WITH_CLAIM, NOW)

		expect(assigned).toEqual([])
	})

	it("CAP-003-R07 leaves the department to the administrator while no claim is configured", async () => {
		const assigned: DepartmentChange[] = []

		await serviceEstablishing(assigned).establish(TX, identityWith({ department: "ONK" }), "004211", POLICY, NOW)

		expect(assigned).toEqual([])
	})

	it("CAP-021-S33 queues the actor of a new account without waiting for the store", async () => {
		const enqueued: string[] = []

		await serviceEstablishing([], enqueued, null).establish(TX, identityWith({}), "004211", POLICY, NOW)

		expect(enqueued).toEqual([USER_ID])
	})

	it("CAP-001-R31 queues the actor when the display name changed", async () => {
		const enqueued: string[] = []

		await serviceEstablishing([], enqueued, "Jana Svobodová").establish(TX, identityWith({}), "004211", POLICY, NOW)

		expect(enqueued).toEqual([USER_ID])
	})

	it("stores the login name and the e-mail from the configured claims at a full login", async () => {
		const accounts: DirectoryAccount[] = []
		const identity = identityWith({ [LOGIN_NAME_CLAIM]: " jnovakova ", [EMAIL_CLAIM]: EMAIL })

		await serviceEstablishing([], [], USER_NAME, accounts).establish(TX, identity, "004211", WITH_ACCOUNT_CLAIMS, NOW)

		expect(accounts).toEqual([{ loginName: "jnovakova", email: EMAIL }])
	})

	it("clears the login name and the e-mail the token leaves out or no claim names", async () => {
		const accounts: DirectoryAccount[] = []
		const identity = identityWith({ [LOGIN_NAME_CLAIM]: "jnovakova", [EMAIL_CLAIM]: EMAIL })
		const service = serviceEstablishing([], [], USER_NAME, accounts)

		await service.establish(TX, identityWith({}), "004211", WITH_ACCOUNT_CLAIMS, NOW)
		await service.establish(TX, identity, "004211", POLICY, NOW)

		expect(accounts).toEqual([
			{ loginName: null, email: null },
			{ loginName: null, email: null },
		])
	})

	it("CAP-001-R31 queues nothing when the full login changed nothing", async () => {
		const enqueued: string[] = []

		await serviceEstablishing([], enqueued).establish(TX, identityWith({}), "004211", POLICY, NOW)

		expect(enqueued).toEqual([])
	})
})

describe("UserIdentityService.findKnownUser", () => {
	const ISSUER = "https://idp.example"

	function serviceLookingUp(identities: Map<string, string>): UserIdentityService {
		const users = {
			findIdentity: async (issuer: string, subject: string) => {
				const userId = identities.get(`${issuer} ${subject}`)
				return userId === undefined ? undefined : { id: "identity-1", userId }
			},
			findById: async (id: string) => (id === USER_ID ? USER : undefined),
			establish: async () => {
				throw new Error("a lookup must not create an account")
			},
		} as unknown as AppUserRepository
		const provider = { issuer: () => ISSUER } as unknown as IdentityProviderPort
		return new UserIdentityService(
			{} as DatabaseService,
			users,
			{} as AuditRepository,
			{} as UserDepartmentService,
			NO_ACTOR_TASKS,
			provider,
		)
	}

	it("finds the user who already signed in with this identity", async () => {
		const service = serviceLookingUp(new Map([[`${ISSUER} subject`, USER_ID]]))
		expect(await service.findKnownUser(identityIn([AUTHORIZED_GROUP]))).toBe(USER)
	})

	it("finds nobody for an identity that never signed in and creates no account", async () => {
		const service = serviceLookingUp(new Map())
		expect(await service.findKnownUser(identityIn([AUTHORIZED_GROUP]))).toBeUndefined()
	})
})
