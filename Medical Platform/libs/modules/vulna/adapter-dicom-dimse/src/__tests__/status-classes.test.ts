import { describe, expect, it } from "vitest"
import {
	type Classification,
	DIMSE_PHASE,
	INFORMATION_MODEL,
	type InformationModel,
	OUTCOME_CLASS,
	RETRY_POLICY,
} from "../contract"
import { echoClassification, findClassification, storeClassification } from "../status-classes"

// integrace-dicom.md 8.1, 8.2, 8.3, dorucovaci-jadro.md 5, ADR-003 ř. 27, ADR-005 ř. 25–39

const STATUS_COUNT = 0x1_00_00
const WARNING_COUNT = 0x10_00
const WARNING_FIRST = 0xb0_00
const ALL_STATUSES = Array.from({ length: STATUS_COUNT }, (_, status) => status)

function response(status: number) {
	return { phase: DIMSE_PHASE.RESPONSE, notSentReason: undefined, status, rejection: undefined }
}

function storeStatusesWhere(property: (classification: Classification) => boolean): number[] {
	return ALL_STATUSES.filter((status) => property(storeClassification(response(status))))
}

function findStatusesWhere(
	property: (classification: Classification) => boolean,
	isCancelled = false,
	informationModel: InformationModel = INFORMATION_MODEL.STUDY_ROOT,
): number[] {
	return ALL_STATUSES.filter((status) => property(findClassification(response(status), informationModel, isCancelled)))
}

describe("integrace-dicom.md 8 classification over every status", () => {
	it("ADR-005 ř. 34 never makes a retention anchor of anything but 0000 and Bxxx of C-STORE", () => {
		const anchors = storeStatusesWhere((classification) => classification.retentionAnchor)

		expect(anchors).toEqual([0x00_00, ...Array.from({ length: WARNING_COUNT }, (_, index) => WARNING_FIRST + index)])
		expect(findStatusesWhere((classification) => classification.retentionAnchor)).toEqual([])
		expect(ALL_STATUSES.some((status) => echoClassification(response(status)).retentionAnchor)).toBe(false)
	})

	it("ADR-005 ř. 27 sends to the clinical safety queue only the data classes and the identity conflict of C-STORE", () => {
		expect(storeStatusesWhere((classification) => classification.clinicalSafetyQueue)).toEqual([
			0xa9_00, 0xc0_00, 0xc0_02, 0xc0_03, 0xc0_04,
		])
		expect(findStatusesWhere((classification) => classification.clinicalSafetyQueue)).toEqual([])
	})

	it("CAP-023-R23 pauses the target only for the configuration statuses", () => {
		expect(storeStatusesWhere((classification) => classification.pauseTarget)).toEqual([
			0x01_22, 0xa7_02, 0xa7_03, 0xa7_05, 0xa7_06,
		])
		expect(findStatusesWhere((classification) => classification.pauseTarget)).toEqual([0xc0_01])
		expect(
			findStatusesWhere((classification) => classification.pauseTarget, false, INFORMATION_MODEL.MODALITY_WORKLIST),
		).toEqual([])
	})

	it("ADR-005 ř. 29, 30 alerts the admin for every C-STORE status but success and the transient ones", () => {
		expect(storeStatusesWhere((classification) => !classification.alertAdmin)).toEqual([
			0x00_00, 0xa7_00, 0xa7_01, 0xa7_04, 0xc0_01,
		])
	})

	it("ADR-005 ř. 28 retries a C-STORE status only for the transient ones, C001 only after verification", () => {
		expect(storeStatusesWhere((classification) => classification.retryPolicy === RETRY_POLICY.BACKOFF)).toEqual([
			0xa7_00, 0xa7_01, 0xa7_04,
		])
		expect(
			storeStatusesWhere((classification) => classification.retryPolicy === RETRY_POLICY.VERIFY_THEN_RETRY),
		).toEqual([0xc0_01])
	})

	it("ADR-005 ř. 39 takes only 0000 of a query that was not cancelled as success", () => {
		const isSuccess = (classification: Classification) => classification.outcomeClass === OUTCOME_CLASS.SUCCESS

		expect(findStatusesWhere(isSuccess)).toEqual([0x00_00])
		expect(findStatusesWhere(isSuccess, true)).toEqual([])
		expect(ALL_STATUSES.filter((status) => isSuccess(echoClassification(response(status))))).toEqual([0x00_00])
	})
})
