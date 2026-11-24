import { ERROR_CODE, RELEASE_KIND } from "@ansora/contracts"
import { ACQUISITION_STATE } from "@ansora/vulna-domain"
import { HttpStatus } from "@nestjs/common"
import { describe, expect, it } from "vitest"
import type { BinaryObjectService } from "../../binary-object/services/binary-object.service"
import type { ClinicalActorRepository } from "../../clinical-record/repositories/clinical-actor.repository"
import type { ClinicalRecordStoreService } from "../../clinical-record/services/clinical-record-store.service"
import { ViewerService } from "../../clinical-record/services/viewer.service"
import {
	CURRENT,
	DEPARTMENT,
	ENCOUNTER,
	foundPatient,
	OTHER_USER,
	PATIENT,
	problemOf,
	USER,
} from "../../encounter/__tests__/encounter-fixtures"
import type { PatientRepository } from "../../registry/repositories/patient.repository"
import { PatientLookupService } from "../../registry/services/patient-lookup.service"
import { FILE_PART, IMAGE_RENDITION, RELEASED_FILE } from "../constants/image.constants"
import type { StoredFileRepository } from "../repositories/stored-file.repository"
import { FileReleaseService } from "../services/file-release.service"
import type { RecordReleaseService } from "../services/record-release.service"
import type { RecordRelease, StoredFileRow } from "../types/image.types"
import {
	ACQUISITION,
	BUFFER_CLEANUP_MOMENT,
	IMAGE,
	ORIGINAL_OBJECT,
	STORED_ORIGINAL,
	STORED_THUMBNAIL,
	storedFile,
	THUMBNAIL_OBJECT,
} from "./image-fixtures"

const ORIGINAL_BYTES = Buffer.from("original jpeg")
const THUMBNAIL_BYTES = Buffer.from("thumbnail jpeg")
const NOW = new Date("2026-10-22T10:00:00.400Z")
const LINK_EXPIRY = "2026-10-22T10:05:00.000Z"

const LINK_STORE = {
	SIGNING: "signing",
	DOWN: "down",
	NOT_CONFIGURED: "not_configured",
} as const

interface Setup {
	file: StoredFileRow | undefined
	readable: boolean
	kept: boolean
	links: (typeof LINK_STORE)[keyof typeof LINK_STORE]
}

interface SignedLink {
	binaryId: string
	expiresAt: Date
}

function linkUrlOf(binaryId: string): string {
	return `https://vulna.invalid/storage/${binaryId}?Signature=signed`
}

function harness(setup: Partial<Setup> = {}) {
	const state: Setup = { file: storedFile(), readable: true, kept: true, links: LINK_STORE.SIGNING, ...setup }
	const releases: RecordRelease[] = []
	const reads: string[] = []
	const signed: SignedLink[] = []
	const failures: string[] = []
	const links = {
		downloadLinkOf: async (binaryId: string, expiresAt: Date) => {
			if (state.links === LINK_STORE.DOWN) {
				throw new Error("the store does not answer")
			}
			signed.push({ binaryId, expiresAt })
			return linkUrlOf(binaryId)
		},
	}
	const stores = {
		links: async () => (state.links === LINK_STORE.NOT_CONFIGURED ? undefined : links),
		reportFailure: (subject: string) => {
			failures.push(subject)
		},
	} as unknown as ClinicalRecordStoreService
	const files = {
		image: async () => state.file,
		documentPage: async () => state.file,
	} as unknown as StoredFileRepository
	const actors = {
		actorOf: async () => ({
			userId: USER,
			displayName: "Test",
			department: { id: DEPARTMENT, code: "KOC" },
			roles: [],
		}),
	} as unknown as ClinicalActorRepository
	const patients = {
		byIds: async (ids: readonly string[]) => ids.filter((id) => id === PATIENT).map((id) => foundPatient(id)),
	} as unknown as PatientRepository
	const recorder = {
		record: async (_current: never, release: RecordRelease) => {
			releases.push(release)
		},
	} as unknown as RecordReleaseService
	const binaries = {
		isKept: async () => state.kept,
		read: async (id: string) => {
			reads.push(id)
			if (!state.readable) {
				throw new Error(`the bytes of binary object ${id} cannot be read`)
			}
			return id === ORIGINAL_OBJECT ? ORIGINAL_BYTES : THUMBNAIL_BYTES
		},
	} as unknown as BinaryObjectService
	const service = new FileReleaseService(
		files,
		new ViewerService(actors),
		new PatientLookupService(patients),
		recorder,
		binaries,
		stores,
	)
	return { service, releases, reads, signed, failures }
}

const NO_RENDITION = null

function bytesOf(bytes: Buffer, rendition: string | null = IMAGE_RENDITION.ORIGINAL) {
	return { kind: RELEASED_FILE.BYTES, bytes, rendition }
}

describe("release of images CAP-020-R22", () => {
	it("CAP-020-S27 CAP-025-R28 releases the original and audits one released image", async () => {
		const run = harness()

		const released = await run.service.image(CURRENT, IMAGE, FILE_PART.ORIGINAL, NOW)

		expect(released).toEqual(bytesOf(ORIGINAL_BYTES))
		expect(run.releases).toEqual([
			{
				kind: RELEASE_KIND.IMAGE,
				objectId: IMAGE,
				patient: foundPatient(PATIENT),
				encounterId: ENCOUNTER,
				acquisitionId: ACQUISITION,
				releasedItemCount: 1,
			},
		])
	})

	it("CAP-020-R09 releases the thumbnail made on the device", async () => {
		const run = harness()

		expect(await run.service.image(CURRENT, IMAGE, FILE_PART.THUMBNAIL, NOW)).toEqual(
			bytesOf(THUMBNAIL_BYTES, NO_RENDITION),
		)
		expect(run.reads).toEqual([THUMBNAIL_OBJECT])
	})

	it("CAP-020-R10 answers a missing thumbnail with 404 and never reads the original", async () => {
		const run = harness({ file: storedFile({ thumbnail_binary_object_id: null }) })

		const problem = await problemOf(run.service.image(CURRENT, IMAGE, FILE_PART.THUMBNAIL, NOW))

		expect(problem.getStatus()).toBe(HttpStatus.NOT_FOUND)
		expect(problem.code).toBe(ERROR_CODE.RESOURCE_NOT_FOUND)
		expect(run.reads).toEqual([])
	})

	it("CAP-015-S59 answers an image of a draft of another user as not found and audits nothing released", async () => {
		const run = harness({ file: storedFile({ state: ACQUISITION_STATE.DRAFT, operator_user_id: OTHER_USER }) })

		const problem = await problemOf(run.service.image(CURRENT, IMAGE, FILE_PART.ORIGINAL, NOW))

		expect(problem.getStatus()).toBe(HttpStatus.NOT_FOUND)
		expect(run.releases).toEqual([expect.objectContaining({ releasedItemCount: 0 })])
		expect(run.reads).toEqual([])
	})

	it("CAP-015-R30 releases an image of the own draft to its operator", async () => {
		const run = harness({ file: storedFile({ state: ACQUISITION_STATE.DRAFT }) })

		expect(await run.service.image(CURRENT, IMAGE, FILE_PART.ORIGINAL, NOW)).toEqual(bytesOf(ORIGINAL_BYTES))
	})

	it("CAP-020-S29 answers an image outside the role scope like an unknown one", async () => {
		const outside = harness({ file: storedFile({ department_id: "other-department" }) })
		const unknown = harness({ file: undefined })

		const outsideProblem = await problemOf(outside.service.image(CURRENT, IMAGE, FILE_PART.ORIGINAL, NOW))
		const unknownProblem = await problemOf(unknown.service.image(CURRENT, IMAGE, FILE_PART.ORIGINAL, NOW))

		expect(outsideProblem.getStatus()).toBe(unknownProblem.getStatus())
		expect(outsideProblem.code).toBe(unknownProblem.code)
		expect(unknown.releases).toEqual([
			{
				kind: RELEASE_KIND.IMAGE,
				objectId: IMAGE,
				patient: undefined,
				encounterId: undefined,
				acquisitionId: undefined,
				releasedItemCount: 0,
			},
		])
	})

	it("CAP-020-S30 answers an original past its retention with 410", async () => {
		const run = harness({ file: storedFile({ binary_object_id: null }) })

		const problem = await problemOf(run.service.image(CURRENT, IMAGE, FILE_PART.ORIGINAL, NOW))

		expect(problem.getStatus()).toBe(HttpStatus.GONE)
		expect(run.reads).toEqual([])
	})

	it("CAP-020-S28 CAP-025-R28 links an original kept only in the store for five minutes and audits the link", async () => {
		const run = harness({ file: storedFile({ buffer_deleted_at: BUFFER_CLEANUP_MOMENT }) })

		const released = await run.service.image(CURRENT, IMAGE, FILE_PART.ORIGINAL, NOW)

		expect(released).toEqual({
			kind: RELEASED_FILE.LINK,
			link: { download_url: linkUrlOf(STORED_ORIGINAL), expires_at: LINK_EXPIRY, rendition: "original" },
		})
		expect(run.signed).toEqual([{ binaryId: STORED_ORIGINAL, expiresAt: new Date(LINK_EXPIRY) }])
		expect(run.reads).toEqual([])
		expect(run.releases).toEqual([expect.objectContaining({ releasedItemCount: 1 })])
	})

	it("CAP-020-S28 links a thumbnail kept only in the store without a rendition", async () => {
		const run = harness({ file: storedFile({ thumbnail_buffer_deleted_at: BUFFER_CLEANUP_MOMENT }) })

		const released = await run.service.image(CURRENT, IMAGE, FILE_PART.THUMBNAIL, NOW)

		expect(released).toEqual({
			kind: RELEASED_FILE.LINK,
			link: { download_url: linkUrlOf(STORED_THUMBNAIL), expires_at: LINK_EXPIRY, rendition: null },
		})
	})

	it("CAP-020-S29 refuses an image outside the role scope before any link is signed", async () => {
		const run = harness({
			file: storedFile({ department_id: "other-department", buffer_deleted_at: BUFFER_CLEANUP_MOMENT }),
		})

		const problem = await problemOf(run.service.image(CURRENT, IMAGE, FILE_PART.ORIGINAL, NOW))

		expect(problem.getStatus()).toBe(HttpStatus.NOT_FOUND)
		expect(run.signed).toEqual([])
	})

	it("CAP-020-S31 answers a store that cannot sign the link as unavailable, never as gone", async () => {
		for (const links of [LINK_STORE.DOWN, LINK_STORE.NOT_CONFIGURED]) {
			const run = harness({ file: storedFile({ buffer_deleted_at: BUFFER_CLEANUP_MOMENT }), links })

			const problem = await problemOf(run.service.image(CURRENT, IMAGE, FILE_PART.ORIGINAL, NOW))

			expect(problem.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE)
			expect(problem.code).toBe(ERROR_CODE.IMAGE_SOURCE_UNAVAILABLE)
			expect(run.reads).toEqual([])
			expect(run.releases).toEqual([expect.objectContaining({ releasedItemCount: 0 })])
		}
	})

	it("CAP-020-S27 releases the buffered bytes of a closed record while the store is down", async () => {
		const run = harness({ links: LINK_STORE.DOWN })

		expect(await run.service.image(CURRENT, IMAGE, FILE_PART.ORIGINAL, NOW)).toEqual(bytesOf(ORIGINAL_BYTES))
	})

	it("CAP-020-S28 links an original the buffer lost once the store confirmed it", async () => {
		const run = harness({ kept: false })

		const released = await run.service.image(CURRENT, IMAGE, FILE_PART.ORIGINAL, NOW)

		expect(released).toEqual({
			kind: RELEASED_FILE.LINK,
			link: { download_url: linkUrlOf(STORED_ORIGINAL), expires_at: LINK_EXPIRY, rendition: "original" },
		})
		expect(run.reads).toEqual([])
	})

	it("CAP-020-S31 answers an original the buffer lost before the store confirmed it as unavailable", async () => {
		const run = harness({ file: storedFile({ clinical_record_binary_id: null }), kept: false, readable: false })

		const problem = await problemOf(run.service.image(CURRENT, IMAGE, FILE_PART.ORIGINAL, NOW))

		expect(problem.code).toBe(ERROR_CODE.IMAGE_SOURCE_UNAVAILABLE)
		expect(run.signed).toEqual([])
	})

	it("CAP-020-S31 answers unreadable bytes with image-source-unavailable and audits nothing released", async () => {
		const run = harness({ readable: false })

		const problem = await problemOf(run.service.image(CURRENT, IMAGE, FILE_PART.ORIGINAL, NOW))

		expect(problem.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE)
		expect(problem.code).toBe(ERROR_CODE.IMAGE_SOURCE_UNAVAILABLE)
		expect(run.releases).toEqual([expect.objectContaining({ releasedItemCount: 0 })])
	})
})

describe("release of document pages CAP-020-R18", () => {
	it("CAP-020-S12 releases a page and audits it as a document page", async () => {
		const run = harness()

		expect(await run.service.documentPage(CURRENT, IMAGE, FILE_PART.ORIGINAL, NOW)).toEqual(bytesOf(ORIGINAL_BYTES))
		expect(run.releases).toEqual([expect.objectContaining({ kind: RELEASE_KIND.DOCUMENT_PAGE, releasedItemCount: 1 })])
	})
})
