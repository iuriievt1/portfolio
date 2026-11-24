import { describe, expect, it } from "vitest"
import { ARTIFACT_SOURCE_KIND } from "../constants/clinical-record.constants"
import type { DeliveredInstanceRow, DeliveredRecordRow } from "../types/clinical-record.types"
import { deliveryOf } from "../utils/delivery-content"

const ACQUISITION_ID = "11111111-1111-4111-8111-111111111111"
const EARLIER_RECORD = "22222222-2222-4222-8222-222222222222"
const RECORD: DeliveredRecordRow = {
	acquisition_id: ACQUISITION_ID,
	patient_id: "33333333-3333-4333-8333-333333333333",
	encounter_id: "44444444-4444-4444-8444-444444444444",
}

function row(change: Partial<DeliveredInstanceRow>): DeliveredInstanceRow {
	return {
		acquisition_id: ACQUISITION_ID,
		source_kind: ARTIFACT_SOURCE_KIND.IMAGE,
		sop_class_uid: "1.2.840.10008.5.1.4.1.1.77.1.4",
		sop_instance_uid: "2.25.1",
		instance_title_written: "ORIGINAL\\PRIMARY",
		instance_description_written: null,
		series_description_written: "Rána 1 · levý bok",
		instance_created_at: new Date("2026-11-09T10:15:30.250Z"),
		retention_anchor: new Date("2026-11-09T10:16:02.000Z"),
		series_instance_uid: "2.25.100",
		instance_number: 1,
		...change,
	}
}

describe("what the clinical record learns once a record is delivered CAP-021-R28 ✓ backend.md 3 T4", () => {
	it("carries every confirmed instance of the touched series and times of this record only", () => {
		const delivery = deliveryOf(RECORD, [
			row({
				acquisition_id: EARLIER_RECORD,
				sop_instance_uid: "2.25.0",
				instance_created_at: new Date("2026-11-10T08:00:00.000Z"),
				retention_anchor: new Date("2026-11-10T08:01:00.000Z"),
			}),
			row({ instance_number: 2 }),
			row({ sop_instance_uid: "2.25.2", instance_number: 3, retention_anchor: new Date("2026-11-09T10:17:00.000Z") }),
		])

		expect(delivery).toMatchObject({
			acquisitionId: ACQUISITION_ID,
			patientId: RECORD.patient_id,
			study: { encounterId: RECORD.encounter_id },
			createdAt: "2026-11-09T10:15:30.250Z",
			confirmedAt: "2026-11-09T10:17:00.000Z",
		})
		expect(delivery?.instances.map((instance) => instance.sopInstanceUid)).toEqual(["2.25.0", "2.25.1", "2.25.2"])
		expect(delivery?.instances[1]).toEqual({
			seriesInstanceUid: "2.25.100",
			sopClassUid: "1.2.840.10008.5.1.4.1.1.77.1.4",
			sopInstanceUid: "2.25.1",
			number: 2,
			title: "ORIGINAL\\PRIMARY",
			description: undefined,
			seriesDescription: "Rána 1 · levý bok",
		})
	})

	it("integrace-dicom.md 5.9 Document Title describes the series of a scanned document", () => {
		const document = row({
			source_kind: ARTIFACT_SOURCE_KIND.DOCUMENT,
			sop_class_uid: "1.2.840.10008.5.1.4.1.1.104.1",
			instance_title_written: "Propouštěcí zpráva",
			series_description_written: null,
		})

		expect(deliveryOf(RECORD, [document])?.instances[0]?.seriesDescription).toBe("Propouštěcí zpráva")
	})

	it("knows no creation time of objects built before it was recorded", () => {
		expect(deliveryOf(RECORD, [row({ instance_created_at: null })])?.createdAt).toBeUndefined()
	})

	it("has nothing to write for a record with no instance the archive confirmed", () => {
		expect(deliveryOf(RECORD, [row({ acquisition_id: EARLIER_RECORD })])).toBeUndefined()
	})
})
