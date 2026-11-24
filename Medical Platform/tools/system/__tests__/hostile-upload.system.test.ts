import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { ACQUISITION_KIND, type AcquisitionKind, DELIVERY_INSTANCE_STATE, ERROR_CODE } from "@ansora/contracts"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { withoutFragmentPadding } from "../pacs/synthetic-pacs"
import {
	closedRecord,
	draftOf,
	identifiedPatientId,
	type OpenRecord,
	openedRecord,
	placedWound,
	titledDocument,
	uploadedFile,
	type VerifiedConfiguration,
	verifiedConfiguration,
} from "../phone/clinical-flow"
import { PhoneProblemError } from "../phone/phone"
import { type SignedInPhone, signedInPhone } from "../phone/signed-in-phone"
import { type DeliveredInstance, settledDeliveryOf } from "../server/delivery"
import { systemContext } from "../support/context"
import { jpegLayoutOf } from "../support/jpeg"
import { DELIVERY_TIMEOUT_MILLISECONDS, FIRST_SEQUENCE, ONE_FILE } from "../support/limits"

// Q-040, quality/data/synteticka-sada/README.md
const SET_DIRECTORY = resolve(__dirname, "../../../quality/data/synteticka-sada")
const REFUSED_PHOTOS = ["executable.jpg", "executable.pdf", "script.jpg", "progressive.jpg"]
// kvalita-rizika-a-pouzitelnost.md 7.1
const REFUSED_PAGES = ["executable.jpg", "executable.pdf", "script.jpg"]
const POLYGLOT = sampleOf("polyglot.jpg")
const BLANK_PAGE = readFileSync(resolve(SET_DIRECTORY, "scan/page-blank.jpg"))
const DOCUMENT_TITLE = "Syntetický dokument s polyglotem"
// quality/data/synteticka-sada/registry.json
const PATIENT_CODE = "1000105"
const CLINICIAN_LABEL = "system-hostile"
const REJECTED = "rejected"

function sampleOf(name: string): Buffer {
	return readFileSync(resolve(SET_DIRECTORY, "hostile", name))
}

async function refusalOf(upload: Promise<unknown>): Promise<PhoneProblemError> {
	try {
		await upload
	} catch (error) {
		if (error instanceof PhoneProblemError) {
			return error
		}
		throw error
	}
	throw new Error("the server received a hostile file")
}

interface HostilePath {
	signedIn: SignedInPhone
	configuration: VerifiedConfiguration
	patientId: string
}

describe("ADR-024, kvalita-rizika-a-pouzitelnost.md 7.1 hostile files through the real upload", () => {
	const context = systemContext()
	const paths = new Map<AcquisitionKind, HostilePath>()
	const refusingRecords = new Map<AcquisitionKind, OpenRecord>()

	async function pathFor(kind: AcquisitionKind): Promise<HostilePath> {
		const signedIn = await signedInPhone(context.sql, context.environment.apiUrl, `${CLINICIAN_LABEL}-${kind}`)
		const configuration = await verifiedConfiguration(signedIn.phone)
		const patientId = await identifiedPatientId(signedIn.phone, configuration, PATIENT_CODE)
		return { signedIn, configuration, patientId }
	}

	function pathOf(kind: AcquisitionKind): HostilePath {
		const path = paths.get(kind)
		if (path === undefined) {
			throw new Error(`no ${kind} path was prepared`)
		}
		return path
	}

	async function recordOf(kind: AcquisitionKind): Promise<OpenRecord> {
		const { signedIn, configuration, patientId } = pathOf(kind)
		return await openedRecord(signedIn.phone, signedIn.clinician, patientId, kind, configuration)
	}

	async function refusedStatusOf(kind: AcquisitionKind, name: string, sequence: number): Promise<string | undefined> {
		const { signedIn, configuration } = pathOf(kind)
		const record = refusingRecords.get(kind)
		if (record === undefined) {
			throw new Error(`no refusing ${kind} record was opened`)
		}
		const sample = sampleOf(name)
		const fileKey = randomUUID()
		const refusal = await refusalOf(
			uploadedFile(signedIn.phone, record, configuration.serverKey, sample, sample, sequence, fileKey),
		)

		expect(refusal.code).toBe(ERROR_CODE.RECORD_REJECTED)
		const draft = await draftOf(signedIn.phone, record)
		return draft.files.find((file) => file.file_key === fileKey)?.status
	}

	async function deliveredPolyglot(kind: AcquisitionKind): Promise<DeliveredInstance> {
		const { signedIn, configuration } = pathOf(kind)
		const record = await recordOf(kind)
		await uploadedFile(signedIn.phone, record, configuration.serverKey, POLYGLOT, POLYGLOT, FIRST_SEQUENCE)
		if (kind === ACQUISITION_KIND.PHOTO) {
			await placedWound(signedIn.phone, record)
		} else {
			await titledDocument(signedIn.phone, record, DOCUMENT_TITLE)
		}
		await closedRecord(signedIn.phone, signedIn.clinician, record, ONE_FILE)
		const [instance] = await settledDeliveryOf(
			context.sql,
			record.acquisitionId,
			ONE_FILE,
			DELIVERY_TIMEOUT_MILLISECONDS,
		)
		if (instance === undefined) {
			throw new Error(`no instance of ${record.acquisitionId} was delivered`)
		}
		return instance
	}

	beforeAll(async () => {
		for (const kind of [ACQUISITION_KIND.PHOTO, ACQUISITION_KIND.SCAN]) {
			paths.set(kind, await pathFor(kind))
			refusingRecords.set(kind, await recordOf(kind))
		}
	})

	afterAll(async () => {
		await context.close()
	})

	it.each(REFUSED_PHOTOS.map((name, index) => ({ name, sequence: FIRST_SEQUENCE + index })))(
		"integrace-dicom.md 3.1, CAP-015-R04 refuses the photo $name and records the file as rejected",
		async ({ name, sequence }) => {
			expect(await refusedStatusOf(ACQUISITION_KIND.PHOTO, name, sequence)).toBe(REJECTED)
		},
	)

	it.each(REFUSED_PAGES.map((name, index) => ({ name, sequence: FIRST_SEQUENCE + index })))(
		"CAP-018-R14 refuses the scan page $name and records the file as rejected",
		async ({ name, sequence }) => {
			expect(await refusedStatusOf(ACQUISITION_KIND.SCAN, name, sequence)).toBe(REJECTED)
		},
	)

	it("CAP-021-S07 delivers the polyglot photo with the image data alone", async () => {
		const instance = await deliveredPolyglot(ACQUISITION_KIND.PHOTO)
		const instanceId = await context.pacs.instanceIdOf(instance.sopInstanceUid)
		const frame = jpegLayoutOf(withoutFragmentPadding(await context.pacs.firstFrameOf(instanceId)))

		expect(instance.state).toBe(DELIVERY_INSTANCE_STATE.CONFIRMED)
		expect(jpegLayoutOf(POLYGLOT).trailer.length).toBeGreaterThan(0)
		expect(frame.scan.equals(jpegLayoutOf(BLANK_PAGE).scan)).toBe(true)
		expect(frame.trailer).toHaveLength(0)
	})

	it("CAP-021-R07 delivers the PDF of the polyglot page without the archive behind the image", async () => {
		const instance = await deliveredPolyglot(ACQUISITION_KIND.SCAN)
		const pdf = await context.pacs.encapsulatedDocumentOf(await context.pacs.instanceIdOf(instance.sopInstanceUid))

		expect(instance.state).toBe(DELIVERY_INSTANCE_STATE.CONFIRMED)
		expect(pdf.includes(jpegLayoutOf(BLANK_PAGE).scan)).toBe(true)
		expect(pdf.includes(jpegLayoutOf(POLYGLOT).trailer)).toBe(false)
	})
})
