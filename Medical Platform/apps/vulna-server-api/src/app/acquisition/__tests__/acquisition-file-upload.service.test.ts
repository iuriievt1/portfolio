import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { ACQUISITION_KIND, ERROR_CODE } from "@ansora/contracts"
import { AUDIT_ACTOR_KIND, AUDIT_EVENT_TYPE } from "@ansora/core-server"
import { ACQUISITION_STATE } from "@ansora/vulna-domain"
import { HttpStatus } from "@nestjs/common"
import { describe, expect, it } from "vitest"
import type { Device } from "../../device/types/device.types"
import {
	acquisitionRow,
	DEVICE,
	foundPatient,
	NOW,
	OTHER_USER,
	problemOf,
	SESSION,
	USER,
} from "../../encounter/__tests__/encounter-fixtures"
import { auditSubjectOf } from "../../registry/utils/patient-view"
import { FILE_KIND, FILE_STATUS } from "../constants/acquisition-file.constants"
import { QUEUE_SENDER } from "../constants/queue-sender.constants"
import type { FileUpload, SealedContent } from "../types/acquisition-file.types"
import type { QueueSender } from "../types/queue-sender.types"
import {
	DRAFT_ID,
	detailsOf,
	FILE_A,
	FILE_B,
	fileHarness,
	jpegWith,
	MAX_BYTES,
	plainContent,
	serverKey,
	sha256Of,
	USER_SENDER,
} from "./acquisition-file-fixtures"

const IMAGE = jpegWith(1)
const MOVED_PATIENT = "77777777-7777-4777-8777-777777777777"
// Q-040, ADR-024, kvalita-rizika-a-pouzitelnost.md 7.1
const HOSTILE_DIRECTORY = resolve(__dirname, "../../../../../../quality/data/synteticka-sada/hostile")

function hostileSample(name: string): Buffer {
	return readFileSync(resolve(HOSTILE_DIRECTORY, name))
}

function closedRecord() {
	return acquisitionRow({ state: ACQUISITION_STATE.RECEIVED, closed_at: NOW, file_count: 1 })
}

function uploadOf(content: SealedContent = plainContent(IMAGE), overrides: Partial<FileUpload> = {}): FileUpload {
	return {
		acquisitionId: DRAFT_ID,
		fileKey: FILE_A,
		kind: ACQUISITION_KIND.PHOTO,
		sha256: sha256Of(IMAGE),
		proposedSequence: 1,
		content,
		...overrides,
	}
}

describe("file received into the draft record CAP-019-R24", () => {
	it("CAP-021-R35 stores the announced image and its thumbnail and confirms the receipt", async () => {
		const run = fileHarness()
		run.files.add({ file_key: FILE_A, announced_by_device_id: DEVICE })

		const file = await run.uploads.upload(USER_SENDER, uploadOf(), NOW)

		expect(file).toMatchObject({ file_key: FILE_A, status: FILE_STATUS.RECEIVED, sha256: sha256Of(IMAGE) })
		expect(run.binaries.stored.get(file.binary_object_id ?? "")).toEqual(IMAGE)
		expect(run.binaries.stored.get(file.thumbnail_binary_object_id ?? "")).toEqual(Buffer.from("thumb"))
		expect(run.drafts.draft.version).toBe(2)
		expect(run.audits.map((event) => event.eventType)).toEqual([AUDIT_EVENT_TYPE.DRAFT_ACQUISITION_UPDATED])
		expect(JSON.stringify(detailsOf(run.audits[0]))).not.toContain("thumb")
	})

	it("CAP-021-S12 opens the HPKE envelopes of the image and its thumbnail", async () => {
		const run = fileHarness()
		const image = run.key.sealed(IMAGE)
		const thumbnail = run.key.sealed(Buffer.from("small"))

		const file = await run.uploads.upload(
			USER_SENDER,
			uploadOf({
				file: image.ciphertext,
				thumbnail: thumbnail.ciphertext,
				encryption: image.envelope,
				thumbnailEncryption: thumbnail.envelope,
			}),
			NOW,
		)

		expect(run.binaries.stored.get(file.binary_object_id ?? "")).toEqual(IMAGE)
		expect(run.binaries.stored.get(file.thumbnail_binary_object_id ?? "")).toEqual(Buffer.from("small"))
	})

	it("announces an upload the server did not hear of at its receipt", async () => {
		const run = fileHarness()
		run.files.received(FILE_B)

		const file = await run.uploads.upload(USER_SENDER, uploadOf(), NOW)

		expect(file).toMatchObject({ file_key: FILE_A, sequence: 2, proposed_sequence: 1, status: FILE_STATUS.RECEIVED })
	})

	it("CAP-021-R29 answers a repeated upload with the stored receipt and stores nothing", async () => {
		const run = fileHarness()
		await run.uploads.upload(USER_SENDER, uploadOf(), NOW)

		const repeated = await run.uploads.upload(USER_SENDER, uploadOf(), NOW)

		expect(repeated.status).toBe(FILE_STATUS.RECEIVED)
		expect(run.binaries.stored.size).toBe(2)
		expect(run.audits).toHaveLength(1)
	})

	it("CAP-015-S57 answers a late repeat of the original upload after a crop with the stored receipt", async () => {
		const run = fileHarness()
		const original = sha256Of(IMAGE)
		run.files.received(FILE_A, { sha256: sha256Of(Buffer.from("cropped")), original_upload_sha256: original })

		const repeated = await run.uploads.upload(USER_SENDER, uploadOf(), NOW)

		expect(repeated.sha256).toBe(sha256Of(Buffer.from("cropped")))
		expect(run.binaries.stored.size).toBe(0)
	})

	it("CAP-021-R29 refuses the same file key with other bytes", async () => {
		const run = fileHarness()
		run.files.received(FILE_A)

		const problem = await problemOf(run.uploads.upload(USER_SENDER, uploadOf(), NOW))

		expect(problem.getStatus()).toBe(HttpStatus.CONFLICT)
		expect(problem.code).toBe(ERROR_CODE.IDEMPOTENCY_CONFLICT)
	})

	it("CAP-019-S19 refuses a file the operator removed on another device", async () => {
		const run = fileHarness()
		run.files.add({ file_key: FILE_A, status: FILE_STATUS.REMOVED })

		const problem = await problemOf(run.uploads.upload(USER_SENDER, uploadOf(), NOW))

		expect(problem.code).toBe(ERROR_CODE.ACQUISITION_ALREADY_DECIDED)
	})

	it("CAP-019-S19 refuses a file of a record closed without it", async () => {
		const run = fileHarness(closedRecord())

		const problem = await problemOf(run.uploads.upload(USER_SENDER, uploadOf(), NOW))

		expect(problem.code).toBe(ERROR_CODE.ACQUISITION_ALREADY_DECIDED)
	})

	it("CAP-021-R23 answers a late repeat of an upload into a closed record with the stored receipt", async () => {
		const run = fileHarness(closedRecord())
		run.files.received(FILE_A, { sha256: sha256Of(IMAGE), original_upload_sha256: sha256Of(IMAGE) })

		const repeated = await run.uploads.upload(USER_SENDER, uploadOf(), NOW)

		expect(repeated).toMatchObject({ file_key: FILE_A, status: FILE_STATUS.RECEIVED })
		expect(run.binaries.stored.size).toBe(0)
		expect(run.audits).toEqual([])
	})

	it("CAP-019-S18 refuses a file of a discarded record", async () => {
		const run = fileHarness()
		run.drafts.rows.clear()
		run.drafts.decided.set(DRAFT_ID, "discarded")

		const problem = await problemOf(run.uploads.upload(USER_SENDER, uploadOf(), NOW))

		expect(problem.code).toBe(ERROR_CODE.ACQUISITION_ALREADY_DECIDED)
	})

	it("CAP-021-R23 answers an upload whose record was closed meanwhile with the stored receipt and drops its bytes", async () => {
		const run = fileHarness()
		run.files.add({ file_key: FILE_A })
		run.transactions.beforeNextTransaction(() => {
			run.drafts.rows.set(DRAFT_ID, closedRecord())
			Object.assign(run.files.byKey(FILE_A) ?? {}, {
				status: FILE_STATUS.RECEIVED,
				binary_object_id: "object-of-the-first-upload",
				sha256: sha256Of(IMAGE),
				original_upload_sha256: sha256Of(IMAGE),
				received_at: NOW,
			})
		})

		const file = await run.uploads.upload(USER_SENDER, uploadOf(), NOW)

		expect(file.binary_object_id).toBe("object-of-the-first-upload")
		expect(run.binaries.recordedRows).toEqual([])
		expect(run.binaries.stored.size).toBe(0)
		expect(run.binaries.discardedBytes).toHaveLength(2)
	})

	it("CAP-026-R14 puts the bytes before the transaction and deletes them when the transaction fails", async () => {
		const run = fileHarness()
		run.files.add({ file_key: FILE_A })
		run.auditLog.failing = true

		await expect(run.uploads.upload(USER_SENDER, uploadOf(), NOW)).rejects.toThrow(/audit/)

		expect(run.binaries.discardedBytes).toEqual(["object-1", "object-2"])
		expect(run.binaries.stored.size).toBe(0)
		expect(run.binaries.recordedRows).toEqual([])
		expect(run.files.byKey(FILE_A)?.status).toBe(FILE_STATUS.ANNOUNCED)
		expect(run.drafts.draft.version).toBe(1)
	})

	it("CAP-014-R07 audits the patient the record belongs to when its row is locked", async () => {
		const run = fileHarness()
		run.transactions.beforeNextTransaction(() => {
			run.drafts.rows.set(DRAFT_ID, { ...run.drafts.draft, patient_id: MOVED_PATIENT })
		})

		await run.uploads.upload(USER_SENDER, uploadOf(), NOW)

		expect(detailsOf(run.audits[0]).patient_identifier).toBe(auditSubjectOf(foundPatient(MOVED_PATIENT)))
	})

	it("ADR-015 rejects bytes whose sha256 differs and keeps the file rejected in the record", async () => {
		const run = fileHarness()
		run.files.add({ file_key: FILE_A })

		const problem = await problemOf(run.uploads.upload(USER_SENDER, uploadOf(plainContent(jpegWith(undefined))), NOW))

		expect(problem.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
		expect(problem.code).toBe(ERROR_CODE.RECORD_REJECTED)
		expect(run.files.byKey(FILE_A)?.status).toBe(FILE_STATUS.REJECTED)
		expect(run.binaries.stored.size).toBe(0)
	})

	it("CAP-025-R26 audits the rejected file as a change of the record", async () => {
		const run = fileHarness()
		run.files.add({ file_key: FILE_A })

		await problemOf(run.uploads.upload(USER_SENDER, uploadOf(plainContent(jpegWith(undefined))), NOW))

		expect(run.audits.map((event) => event.eventType)).toEqual([AUDIT_EVENT_TYPE.DRAFT_ACQUISITION_UPDATED])
		expect(detailsOf(run.audits[0])).toMatchObject({ acquisition_id: DRAFT_ID })
		expect(run.drafts.draft.version).toBe(2)
	})

	it("CAP-015-R04 rejects a file that is not a JPEG stream and keeps it rejected in the record", async () => {
		const run = fileHarness()
		const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

		const problem = await problemOf(
			run.uploads.upload(USER_SENDER, uploadOf(plainContent(png), { sha256: sha256Of(png) }), NOW),
		)

		expect(problem.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
		expect(problem.code).toBe(ERROR_CODE.RECORD_REJECTED)
		expect(run.files.byKey(FILE_A)?.status).toBe(FILE_STATUS.REJECTED)
		expect(run.binaries.stored.size).toBe(0)
	})

	it("CAP-018-R14 rejects a page that is not a JPEG stream", async () => {
		const run = fileHarness(acquisitionRow({ kind: ACQUISITION_KIND.SCAN }))
		const pdf = Buffer.from("%PDF-1.7")

		const problem = await problemOf(
			run.uploads.upload(
				USER_SENDER,
				uploadOf(plainContent(pdf), { kind: ACQUISITION_KIND.SCAN, sha256: sha256Of(pdf) }),
				NOW,
			),
		)

		expect(problem.code).toBe(ERROR_CODE.RECORD_REJECTED)
	})

	it("CAP-021-R07 CAP-015-R36 rejects an image with Exif Orientation other than 1", async () => {
		const run = fileHarness()
		const rotated = jpegWith(6)

		const problem = await problemOf(
			run.uploads.upload(USER_SENDER, uploadOf(plainContent(rotated), { sha256: sha256Of(rotated) }), NOW),
		)

		expect(problem.code).toBe(ERROR_CODE.RECORD_REJECTED)
		expect(run.files.byKey(FILE_A)?.status).toBe(FILE_STATUS.REJECTED)
	})

	it("CAP-021-R21 rejects an envelope that does not open with the server key", async () => {
		const run = fileHarness()
		const sealed = run.key.sealed(IMAGE)

		const problem = await problemOf(
			run.uploads.upload(
				USER_SENDER,
				uploadOf({
					file: Buffer.concat([sealed.ciphertext, Buffer.from("x")]),
					thumbnail: undefined,
					encryption: sealed.envelope,
					thumbnailEncryption: undefined,
				}),
				NOW,
			),
		)

		expect(problem.code).toBe(ERROR_CODE.RECORD_REJECTED)
		expect(run.files.byKey(FILE_A)?.status).toBe(FILE_STATUS.REJECTED)
	})

	it("CAP-015-R36 keeps refusing a file the server rejected", async () => {
		const run = fileHarness()
		run.files.add({ file_key: FILE_A, status: FILE_STATUS.REJECTED })

		const problem = await problemOf(run.uploads.upload(USER_SENDER, uploadOf(), NOW))

		expect(problem.code).toBe(ERROR_CODE.RECORD_REJECTED)
	})

	it("refuses an image in a scan record", async () => {
		const run = fileHarness(acquisitionRow({ kind: ACQUISITION_KIND.SCAN }))

		const problem = await problemOf(run.uploads.upload(USER_SENDER, uploadOf(), NOW))

		expect(problem.code).toBe(ERROR_CODE.RECORD_REJECTED)
	})

	it("CAP-015-R13 refuses an upload larger than the configured body", async () => {
		const run = fileHarness()

		const problem = await problemOf(
			run.uploads.upload(USER_SENDER, uploadOf(plainContent(Buffer.alloc(MAX_BYTES + 1))), NOW),
		)

		expect(problem.getStatus()).toBe(HttpStatus.PAYLOAD_TOO_LARGE)
	})

	it("CAP-018-R14 accepts a page of a scan without checking its orientation", async () => {
		const run = fileHarness(acquisitionRow({ kind: ACQUISITION_KIND.SCAN }))
		const page = jpegWith(6)

		const file = await run.uploads.upload(
			USER_SENDER,
			uploadOf(plainContent(page), { kind: ACQUISITION_KIND.SCAN, sha256: sha256Of(page) }),
			NOW,
		)

		expect(file.status).toBe(FILE_STATUS.RECEIVED)
	})
})

const OTHER_RECORD = "abababab-abab-4bab-8bab-abababababab"

function deviceSender(operatorUserId: string): QueueSender {
	return { kind: QUEUE_SENDER.DEVICE, device: { id: DEVICE } as Device, operatorUserId }
}

// ADR-014, CAP-002-R09
describe("upload under the one-time permission CAP-019-R01", () => {
	async function permittedSender(
		run: ReturnType<typeof fileHarness>,
		announcer: QueueSender = USER_SENDER,
		announced: Buffer = IMAGE,
	): Promise<QueueSender> {
		const result = await run.announcements.announce(
			announcer,
			{
				acquisitionId: DRAFT_ID,
				fileKey: FILE_A,
				fileKind: FILE_KIND.IMAGE,
				sha256: sha256Of(announced),
				proposedSequence: 1,
				replacesFileKey: undefined,
			},
			NOW,
		)
		const permission = await run.permissions.find(result.permission.token, NOW)
		if (permission === undefined) {
			throw new Error("the announcement issued no permission")
		}
		return { kind: QUEUE_SENDER.UPLOAD_PERMISSION, device: { id: DEVICE } as Device, permission }
	}

	it("CAP-025-R17 stores the announced file and names the session that announced it as the sender", async () => {
		const run = fileHarness()
		const sender = await permittedSender(run)

		const file = await run.uploads.upload(sender, uploadOf(), NOW)

		expect(file).toMatchObject({ file_key: FILE_A, status: FILE_STATUS.RECEIVED, sha256: sha256Of(IMAGE) })
		expect(run.audits).toHaveLength(1)
		expect(run.audits[0]).toMatchObject({
			actorKind: AUDIT_ACTOR_KIND.USER,
			actorUserId: USER,
			actorDeviceId: DEVICE,
			sessionId: SESSION,
		})
		expect(detailsOf(run.audits[0])).toMatchObject({ acquisition_id: DRAFT_ID, operator_user_id: USER })
	})

	it("CAP-025-R17 names the device as the sender of a file the queue announced without a session", async () => {
		const run = fileHarness()
		const sender = await permittedSender(run, deviceSender(USER))

		await run.uploads.upload(sender, uploadOf(), NOW)

		expect(run.audits[0]).toMatchObject({ actorKind: AUDIT_ACTOR_KIND.DEVICE, actorDeviceId: DEVICE })
		expect(run.audits[0]?.sessionId).toBeUndefined()
		expect(detailsOf(run.audits[0])).toMatchObject({ operator_user_id: USER })
	})

	it("CAP-021-R29 answers a replayed upload with the stored receipt and stores nothing", async () => {
		const run = fileHarness()
		const sender = await permittedSender(run)
		await run.uploads.upload(sender, uploadOf(), NOW)

		const replayed = await run.uploads.upload(sender, uploadOf(), NOW)

		expect(replayed.status).toBe(FILE_STATUS.RECEIVED)
		expect(run.binaries.stored.size).toBe(2)
		expect(run.audits).toHaveLength(1)
	})

	it("refuses other bytes than the permission was issued for and keeps the file announced", async () => {
		const run = fileHarness()
		const sender = await permittedSender(run)
		const other = jpegWith(undefined)

		const problem = await problemOf(
			run.uploads.upload(sender, uploadOf(plainContent(other), { sha256: sha256Of(other) }), NOW),
		)

		expect(problem.getStatus()).toBe(HttpStatus.UNAUTHORIZED)
		expect(problem.code).toBe(ERROR_CODE.SIGN_IN_AGAIN)
		expect(run.files.byKey(FILE_A)?.status).toBe(FILE_STATUS.ANNOUNCED)
		expect(run.binaries.stored.size).toBe(0)
		expect(run.audits).toEqual([])
	})

	it("CAP-019-R32 refuses bytes that do not match the fingerprint and keeps the file announced", async () => {
		const run = fileHarness()
		const sender = await permittedSender(run)

		const problem = await problemOf(
			run.uploads.upload(sender, uploadOf(plainContent(jpegWith(undefined)), { sha256: sha256Of(IMAGE) }), NOW),
		)

		expect(problem.getStatus()).toBe(HttpStatus.UNAUTHORIZED)
		expect(problem.code).toBe(ERROR_CODE.SIGN_IN_AGAIN)
		expect(run.files.byKey(FILE_A)?.status).toBe(FILE_STATUS.ANNOUNCED)
		expect(run.binaries.stored.size).toBe(0)
		expect(run.audits).toEqual([])
	})

	it("CAP-019-R32 refuses content whose envelope does not open and keeps the file announced", async () => {
		const run = fileHarness()
		const sender = await permittedSender(run)
		const foreign = serverKey().sealed(IMAGE)

		const problem = await problemOf(
			run.uploads.upload(
				sender,
				uploadOf({
					file: foreign.ciphertext,
					thumbnail: undefined,
					encryption: foreign.envelope,
					thumbnailEncryption: undefined,
				}),
				NOW,
			),
		)

		expect(problem.code).toBe(ERROR_CODE.SIGN_IN_AGAIN)
		expect(run.files.byKey(FILE_A)?.status).toBe(FILE_STATUS.ANNOUNCED)
		expect(run.audits).toEqual([])
	})

	it("CAP-015-R36 records a defect of the announced file itself as a rejection", async () => {
		const run = fileHarness()
		const notJpeg = Buffer.from("not a jpeg stream")
		const sender = await permittedSender(run, USER_SENDER, notJpeg)

		const problem = await problemOf(
			run.uploads.upload(sender, uploadOf(plainContent(notJpeg), { sha256: sha256Of(notJpeg) }), NOW),
		)

		expect(problem.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
		expect(problem.code).toBe(ERROR_CODE.RECORD_REJECTED)
		expect(run.files.byKey(FILE_A)?.status).toBe(FILE_STATUS.REJECTED)
		expect(run.audits).toHaveLength(1)
	})

	it("refuses another file of the record", async () => {
		const run = fileHarness()
		const sender = await permittedSender(run)

		const problem = await problemOf(run.uploads.upload(sender, uploadOf(plainContent(IMAGE), { fileKey: FILE_B }), NOW))

		expect(problem.code).toBe(ERROR_CODE.SIGN_IN_AGAIN)
		expect(run.files.byKey(FILE_B)).toBeUndefined()
	})

	it("refuses another record", async () => {
		const run = fileHarness()
		const sender = await permittedSender(run)

		const problem = await problemOf(
			run.uploads.upload(sender, uploadOf(plainContent(IMAGE), { acquisitionId: OTHER_RECORD }), NOW),
		)

		expect(problem.code).toBe(ERROR_CODE.SIGN_IN_AGAIN)
		expect(run.binaries.stored.size).toBe(0)
	})
})

// CAP-002-R09, CAP-025-R17
describe("upload under the device token CAP-002-S33", () => {
	it("stores the file into the record of the operator the queue item carries with the device as the sender", async () => {
		const run = fileHarness()

		const file = await run.uploads.upload(deviceSender(USER), uploadOf(), NOW)

		expect(file).toMatchObject({ file_key: FILE_A, status: FILE_STATUS.RECEIVED })
		expect(run.drafts.draft.state).toBe(ACQUISITION_STATE.DRAFT)
		expect(run.audits[0]).toMatchObject({ actorKind: AUDIT_ACTOR_KIND.DEVICE, actorDeviceId: DEVICE })
		expect(detailsOf(run.audits[0])).toMatchObject({ operator_user_id: USER })
	})

	it("refuses a record of another operator than the queue item carries", async () => {
		const run = fileHarness(acquisitionRow({ operator_user_id: OTHER_USER }))

		const problem = await problemOf(run.uploads.upload(deviceSender(USER), uploadOf(), NOW))

		expect(problem.getStatus()).toBe(HttpStatus.FORBIDDEN)
		expect(problem.code).toBe(ERROR_CODE.RECORD_REJECTED)
		expect(run.binaries.stored.size).toBe(0)
	})

	it("CAP-019-S18 refuses a new file in a closed record", async () => {
		const run = fileHarness(closedRecord())

		const problem = await problemOf(run.uploads.upload(deviceSender(USER), uploadOf(), NOW))

		expect(problem.code).toBe(ERROR_CODE.ACQUISITION_ALREADY_DECIDED)
	})
})

describe("hostile samples of the synthetic set ADR-024, kvalita-rizika-a-pouzitelnost.md 7.1", () => {
	async function refusedPhoto(name: string): Promise<ReturnType<typeof fileHarness>> {
		const run = fileHarness()
		const sample = hostileSample(name)

		const problem = await problemOf(
			run.uploads.upload(USER_SENDER, uploadOf(plainContent(sample), { sha256: sha256Of(sample) }), NOW),
		)

		expect(problem.code).toBe(ERROR_CODE.RECORD_REJECTED)
		return run
	}

	it.each(["executable.jpg", "executable.pdf", "script.jpg"])(
		"CAP-015-R04 refuses the photo %s, which is not a JPEG stream, and stores none of its bytes",
		async (name) => {
			const run = await refusedPhoto(name)

			expect(run.files.byKey(FILE_A)?.status).toBe(FILE_STATUS.REJECTED)
			expect(run.binaries.stored.size).toBe(0)
		},
	)

	it("integrace-dicom.md 3.1, CAP-015-R04 refuses the progressive photo and stores none of its bytes", async () => {
		const run = await refusedPhoto("progressive.jpg")

		expect(run.files.byKey(FILE_A)?.status).toBe(FILE_STATUS.REJECTED)
		expect(run.binaries.stored.size).toBe(0)
	})

	it.each(["executable.jpg", "executable.pdf", "script.jpg"])(
		"CAP-018-R14 refuses the scan page %s and stores none of its bytes",
		async (name) => {
			const run = fileHarness(acquisitionRow({ kind: ACQUISITION_KIND.SCAN }))
			const sample = hostileSample(name)

			const problem = await problemOf(
				run.uploads.upload(
					USER_SENDER,
					uploadOf(plainContent(sample), { kind: ACQUISITION_KIND.SCAN, sha256: sha256Of(sample) }),
					NOW,
				),
			)

			expect(problem.code).toBe(ERROR_CODE.RECORD_REJECTED)
			expect(run.files.byKey(FILE_A)?.status).toBe(FILE_STATUS.REJECTED)
			expect(run.binaries.stored.size).toBe(0)
		},
	)

	it("CAP-015-R04 receives the polyglot photo as it was sent and leaves its archive to the DICOM builder", async () => {
		const run = fileHarness()
		run.files.add({ file_key: FILE_A, announced_by_device_id: DEVICE })
		const polyglot = hostileSample("polyglot.jpg")

		const file = await run.uploads.upload(
			USER_SENDER,
			uploadOf(plainContent(polyglot), { sha256: sha256Of(polyglot) }),
			NOW,
		)

		expect(file.status).toBe(FILE_STATUS.RECEIVED)
		expect(run.binaries.stored.get(file.binary_object_id ?? "")).toEqual(polyglot)
	})
})
