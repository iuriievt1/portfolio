import "reflect-metadata"
import {
	ACQUISITION_KIND,
	ACQUISITION_VERSION_HEADER,
	API_BASE_PATH,
	BEARER_PREFIX,
	ERROR_CODE,
	IDEMPOTENCY_KEY_HEADER,
	OPERATOR_ID_HEADER,
	REQUEST_KEY_HEADER,
	ROLE,
} from "@ansora/contracts"
import { CONFIGURATION_KEY, DEVICE_STATE } from "@ansora/core-server"
import { EDIT_KIND } from "@ansora/vulna-domain"
import { HttpStatus, Module, type Type } from "@nestjs/common"
import { NestFactory, Reflector } from "@nestjs/core"
import type { NestExpressApplication } from "@nestjs/platform-express"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { SERVER_TEXTS } from "../../../i18n"
import { DatabaseService } from "../../../libs/database/database.service"
import { ConfigurationService } from "../../configuration/services/configuration.service"
import { DeviceRepository } from "../../device/repositories/device.repository"
import { DeviceProofService } from "../../device/services/device-proof.service"
import { DeviceTokenService } from "../../device/services/device-token.service"
import { DEVICE, SESSION, USER } from "../../encounter/__tests__/encounter-fixtures"
import { ProblemJsonFilter } from "../../infra/filters/problem-json.filter"
import { applyApiPrefix } from "../../infra/hosting/api-prefix"
import type { LocalizationService } from "../../localization/localization.service"
import { ClinicianRoleGuard } from "../../login/guards/clinician-role.guard"
import { UserSessionGuard } from "../../login/guards/user-session.guard"
import { SessionService } from "../../login/services/session.service"
import { UserIdentityService } from "../../login/services/user-identity.service"
import { DeviceRequestLimitService } from "../../request-rate/services/device-request-limit.service"
import { QUEUE_SENDER } from "../constants/queue-sender.constants"
import { AcquisitionController } from "../controllers/acquisition.controller"
import { AcquisitionAnnouncementController } from "../controllers/acquisition-announcement.controller"
import { AcquisitionDecisionController } from "../controllers/acquisition-decision.controller"
import { AcquisitionFileController } from "../controllers/acquisition-file.controller"
import { AcquisitionUploadController } from "../controllers/acquisition-upload.controller"
import { QueueSenderGuard } from "../guards/queue-sender.guard"
import { AcquisitionAssignmentService } from "../services/acquisition-assignment.service"
import { AcquisitionCancellationService } from "../services/acquisition-cancellation.service"
import { AcquisitionClosureService } from "../services/acquisition-closure.service"
import { AcquisitionDiscardService } from "../services/acquisition-discard.service"
import { AcquisitionDraftService } from "../services/acquisition-draft.service"
import { AcquisitionFileAnnouncementService } from "../services/acquisition-file-announcement.service"
import { AcquisitionFileOrderService } from "../services/acquisition-file-order.service"
import { AcquisitionFileRemovalService } from "../services/acquisition-file-removal.service"
import { AcquisitionFileReplacementService } from "../services/acquisition-file-replacement.service"
import { AcquisitionFileUploadService } from "../services/acquisition-file-upload.service"
import { AcquisitionUpdateService } from "../services/acquisition-update.service"
import { UploadPermissionService } from "../services/upload-permission.service"
import type { ClosureRequest, FileAnnouncement, FileReplacement, FileUpload } from "../types/acquisition-file.types"
import type { QueueSender, UploadPermission } from "../types/queue-sender.types"
import { DRAFT_ID, FILE_A, FILE_B, jpegWith, OTHER_DEVICE, sha256Of } from "./acquisition-file-fixtures"

const MAX_BYTES = 4096
const HOUR_MILLISECONDS = 3_600_000
const IMAGE = jpegWith(1)
const THUMBNAIL = Buffer.from("thumbnail bytes")
const IMAGE_ID = "c1000000-0000-4000-8000-000000000001"
const RECORD_PATH = `${API_BASE_PATH}/acquisitions/${DRAFT_ID}`
const VERSION_TAG = '"4"'
const OPERATOR = "12121212-1212-4212-8212-121212121212"
const PERMISSION_TOKEN = "permission-token"
const PERMISSION_EXPIRES_AT = new Date("2026-10-15T08:00:00Z")
const HARDWARE_ID = "hardware-of-the-device"
const REQUEST_KEY = "d2000000-0000-4000-8000-000000000001"
const PERMISSION: UploadPermission = {
	acquisitionId: DRAFT_ID,
	fileKey: FILE_A,
	deviceId: DEVICE,
	senderSession: undefined,
	sha256: sha256Of(IMAGE),
}

// CAP-002-R09, ADR-014
interface Credentials {
	isUserToken: boolean
	deviceTokenDeviceId: string | undefined
	permission: UploadPermission | undefined
	isDeviceRevoked: boolean
}

const credentials: Credentials = {
	isUserToken: true,
	deviceTokenDeviceId: undefined,
	permission: undefined,
	isDeviceRevoked: false,
}

interface Calls {
	senders: QueueSender[]
	resolves: number
	proofs: number
	limitedDevices: string[]
	uploads: FileUpload[]
	announcements: FileAnnouncement[]
	removals: unknown[]
	replacements: FileReplacement[]
	orders: unknown[]
	closures: ClosureRequest[]
	updates: unknown[]
	creations: unknown[]
	isCreated: boolean
}

const calls: Calls = {
	senders: [],
	resolves: 0,
	proofs: 0,
	limitedDevices: [],
	uploads: [],
	announcements: [],
	removals: [],
	replacements: [],
	orders: [],
	closures: [],
	updates: [],
	creations: [],
	isCreated: true,
}

function fileRowOf(fileKey: string) {
	return { id: IMAGE_ID, file_key: fileKey, sequence: 1, thumbnail_binary_object_id: "thumbnail-object" }
}

const unused = {}
const PARAMETER_TYPES = "design:paramtypes"

function injects(target: Type<unknown>, dependencies: readonly Type<unknown>[]): void {
	Reflect.defineMetadata(PARAMETER_TYPES, dependencies, target)
}

injects(UserSessionGuard, [SessionService, DeviceProofService, Reflector])
injects(ClinicianRoleGuard, [DatabaseService, UserIdentityService])
injects(DeviceTokenService, [DeviceRepository, ConfigurationService, DeviceProofService])
injects(QueueSenderGuard, [
	SessionService,
	UserSessionGuard,
	ClinicianRoleGuard,
	DeviceTokenService,
	UploadPermissionService,
	DeviceRequestLimitService,
	Reflector,
])
injects(AcquisitionUploadController, [AcquisitionFileUploadService])
injects(AcquisitionController, [AcquisitionDraftService, AcquisitionAssignmentService, AcquisitionUpdateService])
injects(AcquisitionAnnouncementController, [AcquisitionFileAnnouncementService])
injects(AcquisitionFileController, [
	AcquisitionFileRemovalService,
	AcquisitionFileReplacementService,
	AcquisitionFileOrderService,
])
injects(AcquisitionDecisionController, [
	AcquisitionClosureService,
	AcquisitionDiscardService,
	AcquisitionCancellationService,
])

@Module({
	controllers: [
		AcquisitionController,
		AcquisitionUploadController,
		AcquisitionAnnouncementController,
		AcquisitionFileController,
		AcquisitionDecisionController,
	],
	providers: [
		UserSessionGuard,
		ClinicianRoleGuard,
		QueueSenderGuard,
		{
			provide: AcquisitionFileUploadService,
			useValue: {
				upload: async (sender: QueueSender, upload: FileUpload) => {
					calls.senders.push(sender)
					calls.uploads.push(upload)
					return fileRowOf(upload.fileKey)
				},
			},
		},
		{
			provide: AcquisitionFileAnnouncementService,
			useValue: {
				announce: async (sender: QueueSender, announcement: FileAnnouncement) => {
					calls.senders.push(sender)
					calls.announcements.push(announcement)
					return {
						created: calls.isCreated,
						file: { file_key: announcement.fileKey },
						permission: { token: PERMISSION_TOKEN, expiresAt: PERMISSION_EXPIRES_AT },
					}
				},
			},
		},
		{
			provide: AcquisitionFileRemovalService,
			useValue: {
				remove: async (_current: unknown, removal: unknown) => {
					calls.removals.push(removal)
				},
			},
		},
		{
			provide: AcquisitionFileReplacementService,
			useValue: {
				replace: async (_current: unknown, replacement: FileReplacement) => {
					calls.replacements.push(replacement)
					return { file_key: replacement.fileKey, edit: replacement.edit }
				},
			},
		},
		{
			provide: AcquisitionFileOrderService,
			useValue: {
				reorder: async (_current: unknown, order: unknown) => {
					calls.orders.push(order)
					return { acquisition_id: DRAFT_ID }
				},
			},
		},
		{
			provide: AcquisitionClosureService,
			useValue: {
				close: async (_current: unknown, closure: ClosureRequest) => {
					calls.closures.push(closure)
					return { acquisition_id: DRAFT_ID, state: "received" }
				},
			},
		},
		{ provide: AcquisitionDiscardService, useValue: unused },
		{ provide: AcquisitionCancellationService, useValue: unused },
		{
			provide: AcquisitionDraftService,
			useValue: {
				create: async (_current: unknown, input: unknown) => {
					calls.creations.push(input)
					return { created: true, receipt: { acquisition_id: DRAFT_ID } }
				},
			},
		},
		{ provide: AcquisitionAssignmentService, useValue: unused },
		{
			provide: AcquisitionUpdateService,
			useValue: {
				update: async (_current: unknown, update: unknown) => {
					calls.updates.push(update)
					return { acquisition_id: DRAFT_ID }
				},
			},
		},
		{
			provide: ConfigurationService,
			useValue: {
				integer: async (key: string) => (key === CONFIGURATION_KEY.ACQUISITION_MAX_BYTES ? MAX_BYTES : 1),
			},
		},
		{
			provide: SessionService,
			useValue: {
				resolve: async () => {
					calls.resolves += 1
					return credentials.isUserToken
						? {
								id: SESSION,
								userId: USER,
								deviceId: DEVICE,
								tokenExpiresAt: new Date(Date.now() + HOUR_MILLISECONDS),
								startedAt: new Date(Date.now() - HOUR_MILLISECONDS),
								sessionEnd: new Date(Date.now() + HOUR_MILLISECONDS),
								endedAt: null,
							}
						: undefined
				},
			},
		},
		{
			provide: DeviceProofService,
			useValue: {
				ofApprovedDevice: async () => {
					calls.proofs += 1
					return { id: DEVICE }
				},
			},
		},
		DeviceTokenService,
		{
			provide: DeviceRepository,
			useValue: {
				findTokenDeviceId: async () => credentials.deviceTokenDeviceId,
				findById: async (id: string) => ({
					id,
					hwId: HARDWARE_ID,
					state: credentials.isDeviceRevoked ? DEVICE_STATE.REVOKED : DEVICE_STATE.APPROVED,
				}),
			},
		},
		{ provide: UploadPermissionService, useValue: { find: async () => credentials.permission } },
		{
			provide: DeviceRequestLimitService,
			useValue: {
				count: async (deviceKey: string) => {
					calls.limitedDevices.push(deviceKey)
				},
			},
		},
		{ provide: DatabaseService, useValue: { sql: unused } },
		{ provide: UserIdentityService, useValue: { rolesOf: async () => [ROLE.CLINICIAN] } },
	],
})
class AcquisitionHttpTestModule {}

let app: NestExpressApplication
let baseUrl: string

beforeAll(async () => {
	app = await NestFactory.create<NestExpressApplication>(AcquisitionHttpTestModule, { logger: false })
	applyApiPrefix(app)
	const localization = {
		responseTexts: async () => ({ texts: SERVER_TEXTS.cs, contentLanguage: "cs" }),
	} as unknown as LocalizationService
	app.useGlobalFilters(new ProblemJsonFilter(localization))
	await app.listen(0)
	baseUrl = await app.getUrl()
})

afterAll(async () => {
	await app.close()
})

beforeEach(() => {
	credentials.isUserToken = true
	credentials.deviceTokenDeviceId = undefined
	credentials.permission = undefined
	credentials.isDeviceRevoked = false
	calls.senders = []
	calls.resolves = 0
	calls.proofs = 0
	calls.limitedDevices = []
	calls.uploads = []
	calls.announcements = []
	calls.removals = []
	calls.replacements = []
	calls.orders = []
	calls.closures = []
	calls.updates = []
	calls.creations = []
	calls.isCreated = true
})

function authorized(headers: Record<string, string> = {}): Record<string, string> {
	return { authorization: `${BEARER_PREFIX}token`, ...headers }
}

function imageForm(image: Buffer = IMAGE, thumbnail: Buffer = THUMBNAIL): FormData {
	const form = new FormData()
	form.append("image", new Blob([image], { type: "image/jpeg" }), "image.jpg")
	form.append("thumbnail", new Blob([thumbnail], { type: "image/jpeg" }), "thumbnail.jpg")
	form.append("sha256", sha256Of(image))
	form.append("sequence", "2")
	return form
}

async function codeOf(response: Response): Promise<unknown> {
	const body = (await response.json()) as { code?: unknown }
	return body.code
}

describe("multipart upload of an image CAP-019-R21", () => {
	it("CAP-021-R23 passes the image, its thumbnail and the file key of Idempotency-Key to the upload", async () => {
		const response = await fetch(`${baseUrl}${RECORD_PATH}/images`, {
			method: "POST",
			headers: authorized({ [IDEMPOTENCY_KEY_HEADER]: FILE_A }),
			body: imageForm(),
		})

		expect(response.status).toBe(HttpStatus.CREATED)
		expect(await response.json()).toEqual({ image_id: IMAGE_ID, is_thumbnail_received: true })
		const [upload] = calls.uploads
		expect(upload).toMatchObject({
			acquisitionId: DRAFT_ID,
			fileKey: FILE_A,
			kind: ACQUISITION_KIND.PHOTO,
			sha256: sha256Of(IMAGE),
			proposedSequence: 2,
		})
		expect(upload?.content.file).toEqual(IMAGE)
		expect(upload?.content.thumbnail).toEqual(THUMBNAIL)
	})

	it("refuses an upload without Idempotency-Key", async () => {
		const response = await fetch(`${baseUrl}${RECORD_PATH}/images`, {
			method: "POST",
			headers: authorized(),
			body: imageForm(),
		})

		expect(response.status).toBe(HttpStatus.BAD_REQUEST)
		expect(calls.uploads).toEqual([])
	})

	it("CAP-015-R13 refuses a body larger than acquisition.max_bytes although each part fits", async () => {
		const half = Buffer.alloc(MAX_BYTES / 2)
		const response = await fetch(`${baseUrl}${RECORD_PATH}/images`, {
			method: "POST",
			headers: authorized({ [IDEMPOTENCY_KEY_HEADER]: FILE_A }),
			body: imageForm(Buffer.concat([IMAGE, half]), half),
		})

		expect(response.status).toBe(HttpStatus.PAYLOAD_TOO_LARGE)
		expect(await codeOf(response)).toBe(ERROR_CODE.RECORD_REJECTED)
		expect(calls.uploads).toEqual([])
	})

	it("CAP-018-R11 passes a page of a scanned document", async () => {
		const form = new FormData()
		form.append("page", new Blob([IMAGE], { type: "image/jpeg" }), "page.jpg")
		form.append("sha256", sha256Of(IMAGE))
		form.append("sequence", "1")

		const response = await fetch(`${baseUrl}${RECORD_PATH}/documents`, {
			method: "POST",
			headers: authorized({ [IDEMPOTENCY_KEY_HEADER]: FILE_B }),
			body: form,
		})

		expect(response.status).toBe(HttpStatus.CREATED)
		expect(await response.json()).toEqual({ page_id: IMAGE_ID, sequence: 1 })
		expect(calls.uploads[0]).toMatchObject({ fileKey: FILE_B, kind: ACQUISITION_KIND.SCAN })
		expect(calls.uploads[0]?.content.thumbnail).toBeUndefined()
	})
})

describe("files of a draft record CAP-015-R35", () => {
	it("CAP-021-R29 answers a new announcement with 201 and its repeat with 200", async () => {
		const announce = async () =>
			await fetch(`${baseUrl}${RECORD_PATH}/files`, {
				method: "POST",
				headers: authorized({ [IDEMPOTENCY_KEY_HEADER]: FILE_A, "content-type": "application/json" }),
				body: JSON.stringify({ file_kind: "image", sha256: sha256Of(IMAGE), proposed_sequence: 3 }),
			})

		const created = await announce()
		calls.isCreated = false
		const repeated = await announce()

		expect(created.status).toBe(HttpStatus.CREATED)
		expect(repeated.status).toBe(HttpStatus.OK)
		expect(await created.json()).toEqual({
			file: { file_key: FILE_A },
			upload_permission: PERMISSION_TOKEN,
			upload_permission_expires_at: PERMISSION_EXPIRES_AT.toISOString(),
		})
		expect(calls.announcements[0]).toMatchObject({
			fileKey: FILE_A,
			fileKind: "image",
			sha256: sha256Of(IMAGE),
			proposedSequence: 3,
		})
	})

	it("ADR-014 refuses an announcement without the fingerprint of the file", async () => {
		const response = await fetch(`${baseUrl}${RECORD_PATH}/files`, {
			method: "POST",
			headers: authorized({ [IDEMPOTENCY_KEY_HEADER]: FILE_A, "content-type": "application/json" }),
			body: JSON.stringify({ file_kind: "image" }),
		})

		expect(response.status).toBe(HttpStatus.BAD_REQUEST)
		expect(calls.announcements).toEqual([])
	})

	it("CAP-021-R32 removes a file over the version of If-Match", async () => {
		const response = await fetch(`${baseUrl}${RECORD_PATH}/files/${FILE_A}`, {
			method: "DELETE",
			headers: authorized({ [ACQUISITION_VERSION_HEADER]: VERSION_TAG }),
		})

		expect(response.status).toBe(HttpStatus.NO_CONTENT)
		expect(calls.removals).toEqual([{ acquisitionId: DRAFT_ID, fileKey: FILE_A, version: 4 }])
	})

	it("CAP-021-R32 refuses a removal without If-Match", async () => {
		const response = await fetch(`${baseUrl}${RECORD_PATH}/files/${FILE_A}`, {
			method: "DELETE",
			headers: authorized(),
		})

		expect(response.status).toBe(HttpStatus.BAD_REQUEST)
		expect(calls.removals).toEqual([])
	})

	it("CAP-015-R34 passes the multipart replacement with its edit and version", async () => {
		const form = new FormData()
		form.append("file", new Blob([IMAGE], { type: "image/jpeg" }), "file.jpg")
		form.append("thumbnail", new Blob([THUMBNAIL], { type: "image/jpeg" }), "thumbnail.jpg")
		form.append("sha256", sha256Of(IMAGE))
		form.append("edit", EDIT_KIND.CROP)

		const response = await fetch(`${baseUrl}${RECORD_PATH}/files/${FILE_A}`, {
			method: "PUT",
			headers: authorized({ [ACQUISITION_VERSION_HEADER]: VERSION_TAG }),
			body: form,
		})

		expect(response.status).toBe(HttpStatus.OK)
		expect(calls.replacements[0]).toMatchObject({ fileKey: FILE_A, version: 4, edit: EDIT_KIND.CROP })
		expect(calls.replacements[0]?.content.file).toEqual(IMAGE)
	})

	it("CAP-015-R33 passes the new order over the version of If-Match", async () => {
		const response = await fetch(`${baseUrl}${RECORD_PATH}/file-order`, {
			method: "PUT",
			headers: authorized({ [ACQUISITION_VERSION_HEADER]: VERSION_TAG, "content-type": "application/json" }),
			body: JSON.stringify({ file_keys: [FILE_B, FILE_A] }),
		})

		expect(response.status).toBe(HttpStatus.OK)
		expect(calls.orders).toEqual([{ acquisitionId: DRAFT_ID, version: 4, fileKeys: [FILE_B, FILE_A] }])
	})
})

describe("closure of a record CAP-014-R14", () => {
	const closure = {
		file_count: 2,
		completed_at: "2026-10-07T07:59:50Z",
		operator: { user_id: USER, session_id: SESSION },
	}

	it("CAP-021-R32 passes the closure with the version of If-Match", async () => {
		const response = await fetch(`${baseUrl}${RECORD_PATH}/closure`, {
			method: "POST",
			headers: authorized({ [ACQUISITION_VERSION_HEADER]: VERSION_TAG, "content-type": "application/json" }),
			body: JSON.stringify(closure),
		})

		expect(response.status).toBe(HttpStatus.OK)
		expect(calls.closures).toEqual([
			{
				acquisitionId: DRAFT_ID,
				version: 4,
				fileCount: 2,
				completedAt: new Date("2026-10-07T07:59:50Z"),
				operator: { userId: USER, sessionId: SESSION },
			},
		])
	})

	it("refuses a version that is not a quoted number", async () => {
		const response = await fetch(`${baseUrl}${RECORD_PATH}/closure`, {
			method: "POST",
			headers: authorized({ [ACQUISITION_VERSION_HEADER]: "4", "content-type": "application/json" }),
			body: JSON.stringify(closure),
		})

		expect(response.status).toBe(HttpStatus.BAD_REQUEST)
		expect(calls.closures).toEqual([])
	})
})

// CAP-002-R09, ADR-014
describe("sender of the device queue CAP-019-R01", () => {
	function asDeviceToken(deviceId: string = DEVICE): void {
		credentials.isUserToken = false
		credentials.deviceTokenDeviceId = deviceId
	}

	function asUploadPermission(): void {
		credentials.isUserToken = false
		credentials.permission = PERMISSION
	}

	async function announceFile(headers: Record<string, string> = {}): Promise<Response> {
		return await fetch(`${baseUrl}${RECORD_PATH}/files`, {
			method: "POST",
			headers: authorized({ [IDEMPOTENCY_KEY_HEADER]: FILE_A, "content-type": "application/json", ...headers }),
			body: JSON.stringify({ file_kind: "image", sha256: sha256Of(IMAGE) }),
		})
	}

	async function completeRecord(headers: Record<string, string> = {}): Promise<Response> {
		return await fetch(`${baseUrl}${RECORD_PATH}`, {
			method: "PATCH",
			headers: authorized({
				[ACQUISITION_VERSION_HEADER]: VERSION_TAG,
				[REQUEST_KEY_HEADER]: REQUEST_KEY,
				"content-type": "application/json",
				...headers,
			}),
			body: JSON.stringify({ assessment: { description: "Klidné okraje" } }),
		})
	}

	async function uploadImage(): Promise<Response> {
		return await fetch(`${baseUrl}${RECORD_PATH}/images`, {
			method: "POST",
			headers: authorized({ [IDEMPOTENCY_KEY_HEADER]: FILE_A }),
			body: imageForm(),
		})
	}

	it("resolves the session of a user once per request", async () => {
		const response = await announceFile()

		expect(response.status).toBe(HttpStatus.CREATED)
		expect(calls.resolves).toBe(1)
		expect(calls.senders[0]?.kind).toBe(QUEUE_SENDER.USER)
	})

	it("CAP-002-S33 announces a file under the device token for the operator of the queue item", async () => {
		asDeviceToken()

		const response = await announceFile({ [OPERATOR_ID_HEADER]: OPERATOR })

		expect(response.status).toBe(HttpStatus.CREATED)
		expect(calls.senders).toEqual([{ kind: QUEUE_SENDER.DEVICE, device: { id: DEVICE }, operatorUserId: OPERATOR }])
		expect(calls.proofs).toBe(1)
	})

	it("CAP-002-R09 refuses the device token without the operator of the queue item", async () => {
		asDeviceToken()

		const response = await announceFile()

		expect(response.status).toBe(HttpStatus.FORBIDDEN)
		expect(await codeOf(response)).toBe(ERROR_CODE.RECORD_REJECTED)
		expect(calls.announcements).toEqual([])
	})

	it("CAP-015-R30 completes the record in the session of its operator", async () => {
		const response = await completeRecord()

		expect(response.status).toBe(HttpStatus.OK)
		expect(calls.updates).toHaveLength(1)
	})

	it("CAP-002-S31 founds no record under the device token, even for the operator of the queue item", async () => {
		asDeviceToken()

		const response = await fetch(`${baseUrl}${API_BASE_PATH}/acquisitions`, {
			method: "POST",
			headers: authorized({
				[IDEMPOTENCY_KEY_HEADER]: REQUEST_KEY,
				[OPERATOR_ID_HEADER]: OPERATOR,
				"content-type": "application/json",
			}),
			body: JSON.stringify({}),
		})

		expect(response.status).toBe(HttpStatus.UNAUTHORIZED)
		expect(await codeOf(response)).toBe(ERROR_CODE.SIGN_IN_AGAIN)
		expect(calls.creations).toEqual([])
	})

	it("CAP-002-S32 does not complete the record under the device token, even for the operator of the queue item", async () => {
		asDeviceToken()

		const response = await completeRecord({ [OPERATOR_ID_HEADER]: OPERATOR })

		expect(response.status).toBe(HttpStatus.UNAUTHORIZED)
		expect(await codeOf(response)).toBe(ERROR_CODE.SIGN_IN_AGAIN)
		expect(calls.updates).toEqual([])
	})

	it("ADR-013 refuses the device token of another device than the one that signed the request", async () => {
		asDeviceToken(OTHER_DEVICE)

		const response = await announceFile({ [OPERATOR_ID_HEADER]: OPERATOR })

		expect(response.status).toBe(HttpStatus.UNAUTHORIZED)
		expect(await codeOf(response)).toBe(ERROR_CODE.SIGN_IN_AGAIN)
		expect(calls.announcements).toEqual([])
	})

	it("ADR-014 uploads under the permission without a device proof", async () => {
		asUploadPermission()

		const response = await uploadImage()

		expect(response.status).toBe(HttpStatus.CREATED)
		expect(calls.senders).toEqual([
			{
				kind: QUEUE_SENDER.UPLOAD_PERMISSION,
				device: { id: DEVICE, hwId: HARDWARE_ID, state: DEVICE_STATE.APPROVED },
				permission: PERMISSION,
			},
		])
		expect(calls.proofs).toBe(0)
	})

	it("api/README.md 7 counts an upload under the permission against the limit of its device", async () => {
		asUploadPermission()

		await uploadImage()

		expect(calls.limitedDevices).toEqual([HARDWARE_ID])
	})

	it("ADR-014 refuses the permission on the announcement", async () => {
		asUploadPermission()

		const response = await announceFile({ [OPERATOR_ID_HEADER]: OPERATOR })

		expect(response.status).toBe(HttpStatus.UNAUTHORIZED)
		expect(await codeOf(response)).toBe(ERROR_CODE.SIGN_IN_AGAIN)
		expect(calls.announcements).toEqual([])
	})

	it("ADR-014 refuses the permission on the closure of the record", async () => {
		asUploadPermission()

		const response = await fetch(`${baseUrl}${RECORD_PATH}/closure`, {
			method: "POST",
			headers: authorized({ [ACQUISITION_VERSION_HEADER]: VERSION_TAG, "content-type": "application/json" }),
			body: JSON.stringify({
				file_count: 1,
				completed_at: "2026-10-07T07:59:50Z",
				operator: { user_id: USER, session_id: SESSION },
			}),
		})

		expect(response.status).toBe(HttpStatus.UNAUTHORIZED)
		expect(calls.closures).toEqual([])
	})

	it("ADR-014 refuses an expired or unknown permission", async () => {
		credentials.isUserToken = false

		const response = await uploadImage()

		expect(response.status).toBe(HttpStatus.UNAUTHORIZED)
		expect(await codeOf(response)).toBe(ERROR_CODE.SIGN_IN_AGAIN)
		expect(calls.uploads).toEqual([])
	})

	it("CAP-002-R08 refuses the permission of a revoked device at once", async () => {
		asUploadPermission()
		credentials.isDeviceRevoked = true

		const response = await uploadImage()

		expect(response.status).toBe(HttpStatus.FORBIDDEN)
		expect(await codeOf(response)).toBe(ERROR_CODE.DEVICE_REVOKED)
		expect(calls.uploads).toEqual([])
		expect(calls.limitedDevices).toEqual([])
	})

	it("refuses a request without a bearer token", async () => {
		const response = await fetch(`${baseUrl}${RECORD_PATH}/images`, {
			method: "POST",
			headers: { [IDEMPOTENCY_KEY_HEADER]: FILE_A },
			body: imageForm(),
		})

		expect(response.status).toBe(HttpStatus.UNAUTHORIZED)
		expect(calls.uploads).toEqual([])
	})
})
