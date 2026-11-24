import { ADMINISTRATION_ERROR_CODE, ERROR_CODE, ORPHANED_OBJECT_DELETION_REASON_MAX_LENGTH } from "@ansora/contracts"
import { PERMISSION } from "@ansora/core-server"
import { HttpStatus, Module } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { AdministrationSessionService } from "../../administration-session/services/administration-session.service"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import {
	type AdministrationHttp,
	codeOf,
	injects,
	startAdministrationHttp,
} from "../../infra/__tests__/administration-http"
import type { PageInput } from "../../infra/dto/page.input.dto"
import { AdministrationSessionGuard } from "../../infra/guards/administration-session.guard"
import { ORPHANED_OBJECTS_PATH } from "../constants/orphaned-object.constants"
import { OrphanedObjectController } from "../controllers/orphaned-object.controller"
import type { OrphanedObjectDeletionInput } from "../dto/orphaned-object-deletion.input.dto"
import { OrphanedObjectService } from "../services/orphaned-object.service"
import type { OrphanedObjectView } from "../types/orphaned-object.types"

const MANAGER_TOKEN = "manager"
const READER_TOKEN = "reader"
const OUTSIDER_TOKEN = "outsider"
const OBJECT_ID = "5f0e1d2c-3b4a-4596-8778-695a4b3c2d1e"
const DELETION_PATH = `${ORPHANED_OBJECTS_PATH}/${OBJECT_ID}/deletion`
const REASON = "Zbytek po přerušeném nahrávání"

// CAP-003-R13
const MANAGER: AdministrationSession = {
	sessionId: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
	userId: "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e",
	permissions: [PERMISSION.ADMINISTRATION_ACCESS, PERMISSION.MONITORING_MANAGE],
}

const READER: AdministrationSession = {
	sessionId: "3c4d5e6f-7a8b-4c9d-8e0f-2a3b4c5d6e7f",
	userId: "4d5e6f7a-8b9c-4d0e-8f1a-3b4c5d6e7f8a",
	permissions: [PERMISSION.ADMINISTRATION_ACCESS],
}

const OUTSIDER: AdministrationSession = {
	...READER,
	sessionId: "5e6f7a8b-9c0d-4e1f-8a2b-4c5d6e7f8a9b",
	permissions: [],
}

const SESSIONS: Readonly<Record<string, AdministrationSession>> = {
	[MANAGER_TOKEN]: MANAGER,
	[READER_TOKEN]: READER,
	[OUTSIDER_TOKEN]: OUTSIDER,
}

const ORPHAN: OrphanedObjectView = {
	id: OBJECT_ID,
	size_bytes: 2048,
	sha256: "c".repeat(64),
	created_at: "2026-11-10T08:00:00.000Z",
	set_aside_at: "2026-11-11T09:00:00.000Z",
}

const calls = {
	listed: [] as PageInput[],
	deleted: [] as unknown[][],
}

injects(AdministrationSessionGuard, [AdministrationSessionService, Reflector])
injects(OrphanedObjectController, [OrphanedObjectService])

@Module({
	controllers: [OrphanedObjectController],
	providers: [
		Reflector,
		AdministrationSessionGuard,
		{ provide: AdministrationSessionService, useValue: { resolve: async (token: string) => SESSIONS[token] } },
		{
			provide: OrphanedObjectService,
			useValue: {
				list: async (query: PageInput) => {
					calls.listed.push(query)
					return { items: [ORPHAN], next_cursor: null }
				},
				delete: async (
					objectId: string,
					deletion: OrphanedObjectDeletionInput,
					administrator: AdministrationSession,
				) => {
					calls.deleted.push([objectId, deletion, administrator.userId])
				},
			},
		},
	],
})
class OrphanedObjectHttpTestModule {}

let http: AdministrationHttp

beforeAll(async () => {
	http = await startAdministrationHttp(OrphanedObjectHttpTestModule)
})

afterAll(async () => {
	await http.close()
})

beforeEach(() => {
	calls.listed.length = 0
	calls.deleted.length = 0
})

describe("set-aside orphaned objects over HTTP CAP-026-R14, administration.yaml listOrphanedObjects, deleteOrphanedObject", () => {
	it("CAP-026-S07 lists the set-aside objects to an administrator who only reads", async () => {
		const response = await http.request(`${ORPHANED_OBJECTS_PATH}?limit=20`, READER_TOKEN)

		expect(response.status).toBe(HttpStatus.OK)
		expect(await response.json()).toEqual({ items: [ORPHAN], next_cursor: null })
		expect(calls.listed).toEqual([{ limit: 20 }])
	})

	it("CAP-003-R13 shows the set-aside objects to nobody without the administration role", async () => {
		const response = await http.request(ORPHANED_OBJECTS_PATH, OUTSIDER_TOKEN)

		expect(response.status).toBe(HttpStatus.FORBIDDEN)
		expect(await codeOf(response)).toBe(ADMINISTRATION_ERROR_CODE.PERMISSION_DENIED)
		expect(calls.listed).toEqual([])
	})

	it("CAP-026-S08 deletes the set-aside object with the reason of the administrator and answers with no content", async () => {
		const response = await http.request(DELETION_PATH, MANAGER_TOKEN, {
			method: "POST",
			body: JSON.stringify({ reason: ` ${REASON} ` }),
		})

		expect(response.status).toBe(HttpStatus.NO_CONTENT)
		expect(calls.deleted).toEqual([[OBJECT_ID, { reason: REASON }, MANAGER.userId]])
	})

	it("CAP-003-R13 refuses the deletion to an administrator without the monitoring permission", async () => {
		const response = await http.request(DELETION_PATH, READER_TOKEN, {
			method: "POST",
			body: JSON.stringify({ reason: REASON }),
		})

		expect(response.status).toBe(HttpStatus.FORBIDDEN)
		expect(await codeOf(response)).toBe(ADMINISTRATION_ERROR_CODE.PERMISSION_DENIED)
		expect(calls.deleted).toEqual([])
	})

	it.each([
		{},
		{ reason: "   " },
		{ reason: "x".repeat(ORPHANED_OBJECT_DELETION_REASON_MAX_LENGTH + 1) },
		{ reason: REASON, all: true },
	])("CAP-026-S08 refuses the deletion body %j with HTTP 400 and deletes nothing", async (body) => {
		const response = await http.request(DELETION_PATH, MANAGER_TOKEN, { method: "POST", body: JSON.stringify(body) })

		expect(response.status).toBe(HttpStatus.BAD_REQUEST)
		expect(await codeOf(response)).toBe(ERROR_CODE.RECORD_REJECTED)
		expect(calls.deleted).toEqual([])
	})

	it("CAP-026-S08 refuses an identifier that is not one of an object", async () => {
		const response = await http.request(`${ORPHANED_OBJECTS_PATH}/not-an-object/deletion`, MANAGER_TOKEN, {
			method: "POST",
			body: JSON.stringify({ reason: REASON }),
		})

		expect(response.status).toBe(HttpStatus.BAD_REQUEST)
		expect(calls.deleted).toEqual([])
	})

	it("CAP-026-R14 offers no deletion of every set-aside object at once", async () => {
		const response = await http.request(`${ORPHANED_OBJECTS_PATH}/deletion`, MANAGER_TOKEN, {
			method: "POST",
			body: JSON.stringify({ reason: REASON }),
		})

		expect(response.status).toBe(HttpStatus.NOT_FOUND)
		expect(calls.deleted).toEqual([])
	})
})
