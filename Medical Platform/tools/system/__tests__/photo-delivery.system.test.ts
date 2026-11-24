import {
	ACQUISITION_KIND,
	ACQUISITION_STATE_VALUE,
	type AcquisitionStateValue,
	AUDIT_EVENT_TYPE,
	AUDIT_OUTCOME,
	DELIVERY_INSTANCE_STATE,
} from "@ansora/contracts"
import { SOP_CLASS, STORE_DECISION } from "@ansora/vulna-domain"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { type DicomTags, withoutFragmentPadding } from "../pacs/synthetic-pacs"
import {
	closedRecord,
	identifiedPatientId,
	openedRecord,
	placedWound,
	uploadedFile,
	verifiedConfiguration,
} from "../phone/clinical-flow"
import { PHOTO } from "../phone/photo-record"
import { signedInPhone } from "../phone/signed-in-phone"
import { type DeliveredInstance, settledDeliveryOf } from "../server/delivery"
import { systemContext } from "../support/context"
import { APP1, COMMENT, type JpegLayout, jpegLayoutOf, withLocationAndComment } from "../support/jpeg"
import { DELIVERY_TIMEOUT_MILLISECONDS, FIRST_SEQUENCE, ONE_FILE } from "../support/limits"

// quality/data/synteticka-sada/registry.json
const PATIENT_CODE = "1000101"
const CLINICIAN_LABEL = "system-photo"
// integrace-dicom.md 5.1
const EXTERNAL_CAMERA_PHOTOGRAPHY = "XC"
// CAP-021-S03, ISO/IEC 9834-8
const GENERATED_UID_ROOT = "2.25."
// DICOM PS3.7 C
const DIMSE_SUCCESS = "0000"
const NO_DELIVERY_ROWS = 0
const PHOTO_WITH_METADATA = withLocationAndComment(PHOTO)

interface AttemptRow {
	outcome: string
	result: string | null
}

describe("ADR-024 a wound photo from the phone to the synthetic PACS", () => {
	const context = systemContext()
	let deliveryRowsBeforeClosure: number
	let deliveryRowsAfterClosure: number
	let closedState: AcquisitionStateValue
	let instance: DeliveredInstance
	let attempts: AttemptRow[]
	let tags: DicomTags
	let frame: JpegLayout

	async function deliveryRowsOf(acquisitionId: string): Promise<number> {
		const [row] = await context.sql<{ count: number }[]>`
			SELECT count(*)::integer AS count FROM delivery WHERE acquisition_id = ${acquisitionId}
		`
		return row?.count ?? NO_DELIVERY_ROWS
	}

	beforeAll(async () => {
		const { phone, clinician } = await signedInPhone(context.sql, context.environment.apiUrl, CLINICIAN_LABEL)
		const configuration = await verifiedConfiguration(phone)
		const patientId = await identifiedPatientId(phone, configuration, PATIENT_CODE)
		const record = await openedRecord(phone, clinician, patientId, ACQUISITION_KIND.PHOTO, configuration)
		await placedWound(phone, record)
		await uploadedFile(phone, record, configuration.serverKey, PHOTO_WITH_METADATA, PHOTO, FIRST_SEQUENCE)
		deliveryRowsBeforeClosure = await deliveryRowsOf(record.acquisitionId)
		closedState = (await closedRecord(phone, clinician, record, ONE_FILE)).state
		deliveryRowsAfterClosure = await deliveryRowsOf(record.acquisitionId)
		const [delivered] = await settledDeliveryOf(
			context.sql,
			record.acquisitionId,
			ONE_FILE,
			DELIVERY_TIMEOUT_MILLISECONDS,
		)
		if (delivered === undefined) {
			throw new Error(`no instance of ${record.acquisitionId} was delivered`)
		}
		instance = delivered
		attempts = await context.sql<AttemptRow[]>`
			SELECT outcome, details->>'result' AS result FROM audit
			WHERE event_type = ${AUDIT_EVENT_TYPE.DELIVERY_ATTEMPT} AND details->>'sop_instance_uid' = ${instance.sopInstanceUid}
		`
		const instanceId = await context.pacs.instanceIdOf(instance.sopInstanceUid)
		tags = await context.pacs.tagsOf(instanceId)
		frame = jpegLayoutOf(withoutFragmentPadding(await context.pacs.firstFrameOf(instanceId)))
	})

	afterAll(async () => {
		await context.close()
	})

	it("CAP-021-S01 writes the delivery row with the closure and not before", () => {
		expect(deliveryRowsBeforeClosure).toBe(NO_DELIVERY_ROWS)
		expect(closedState).toBe(ACQUISITION_STATE_VALUE.RECEIVED)
		expect(deliveryRowsAfterClosure).toBe(ONE_FILE)
	})

	it("CAP-023-S01 confirms the instance, audits the attempt with its result and anchors the retention", () => {
		expect(instance.state).toBe(DELIVERY_INSTANCE_STATE.CONFIRMED)
		expect(instance.lastDimseStatus).toBe(DIMSE_SUCCESS)
		expect(instance.isRetentionAnchored).toBe(true)
		expect(attempts).toEqual([{ outcome: AUDIT_OUTCOME.SUCCESS, result: STORE_DECISION.CONFIRMED }])
	})

	it("CAP-021-S03 stores a VL Photographic Image with Modality XC in a study the server generated", () => {
		expect(tags.SOPClassUID).toBe(SOP_CLASS.VL_PHOTOGRAPHIC_IMAGE)
		expect(instance.sopClassUid).toBe(SOP_CLASS.VL_PHOTOGRAPHIC_IMAGE)
		expect(tags.Modality).toBe(EXTERNAL_CAMERA_PHOTOGRAPHY)
		expect(tags.PatientID).toBe(PATIENT_CODE)
		expect(String(tags.StudyInstanceUID)).toMatch(new RegExp(`^${GENERATED_UID_ROOT.replaceAll(".", "\\.")}`))
		expect(tags.AccessionNumber ?? "").toBe("")
	})

	it("CAP-021-R11 keeps the image data of the photo as it was taken", () => {
		expect(frame.scan.equals(jpegLayoutOf(PHOTO).scan)).toBe(true)
		expect(frame.trailer).toHaveLength(0)
	})

	it("CAP-021-S07 leaves out the location and the comment the photo carried", () => {
		expect(jpegLayoutOf(PHOTO_WITH_METADATA).headerMarkers).toEqual(expect.arrayContaining([APP1, COMMENT]))
		expect(frame.headerMarkers).not.toContain(APP1)
		expect(frame.headerMarkers).not.toContain(COMMENT)
	})
})
