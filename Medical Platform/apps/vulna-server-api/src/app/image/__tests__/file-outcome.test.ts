import { ACQUISITION_STATE } from "@ansora/vulna-domain"
import { describe, expect, it } from "vitest"
import { FILE_STATUS } from "../../acquisition/constants/acquisition-file.constants"
import { DEPARTMENT, OTHER_USER, USER } from "../../encounter/__tests__/encounter-fixtures"
import { FILE_PART } from "../constants/image.constants"
import { fileOutcomeOf } from "../utils/file-outcome"
import { isRecordVisibleTo } from "../utils/record-scope"
import {
	BUFFER_CLEANUP_MOMENT,
	ORIGINAL_OBJECT,
	STORED_ORIGINAL,
	STORED_THUMBNAIL,
	STORED_VIEWING_COPY,
	storedFile,
	THUMBNAIL_OBJECT,
	VIEWING_COPY_OBJECT,
} from "./image-fixtures"

const CLINICIAN = { userId: USER, departmentId: DEPARTMENT }
const OTHER_DEPARTMENT_CLINICIAN = { userId: OTHER_USER, departmentId: "other-department" }
const CLINICIAN_WITHOUT_DEPARTMENT = { userId: OTHER_USER, departmentId: undefined }

describe("scope of a record CAP-020-R04", () => {
	it("CAP-020-S11 opens a closed record of the department to anyone in it", () => {
		const closed = storedFile({ operator_user_id: OTHER_USER })

		expect(isRecordVisibleTo(closed, CLINICIAN)).toBe(true)
	})

	it("CAP-020-S14 hides a closed record of another department", () => {
		expect(isRecordVisibleTo(storedFile(), OTHER_DEPARTMENT_CLINICIAN)).toBe(false)
	})

	it("CAP-003-R01 hides every closed record from a clinician without a department", () => {
		expect(isRecordVisibleTo(storedFile({ department_id: null }), CLINICIAN_WITHOUT_DEPARTMENT)).toBe(false)
	})

	it("CAP-015-R30 shows a draft to its operator only", () => {
		const draft = storedFile({ state: ACQUISITION_STATE.DRAFT })

		expect(isRecordVisibleTo(draft, CLINICIAN)).toBe(true)
		expect(isRecordVisibleTo(draft, { userId: OTHER_USER, departmentId: DEPARTMENT })).toBe(false)
	})
})

describe("release of a file CAP-020-R22", () => {
	it("CAP-020-S27 releases the original of a received image", () => {
		expect(fileOutcomeOf(storedFile(), CLINICIAN, FILE_PART.ORIGINAL)).toEqual({
			kind: "release",
			binaryObjectId: ORIGINAL_OBJECT,
			clinicalRecordBinaryId: STORED_ORIGINAL,
			rendition: "original",
		})
	})

	it("CAP-020-R09 releases the thumbnail from its own binary object", () => {
		expect(fileOutcomeOf(storedFile(), CLINICIAN, FILE_PART.THUMBNAIL)).toEqual({
			kind: "release",
			binaryObjectId: THUMBNAIL_OBJECT,
			clinicalRecordBinaryId: STORED_THUMBNAIL,
			rendition: null,
		})
	})

	it("CAP-020-R10 answers a missing thumbnail as not found, never with the original", () => {
		const file = storedFile({ thumbnail_binary_object_id: null })

		expect(fileOutcomeOf(file, CLINICIAN, FILE_PART.THUMBNAIL)).toEqual({ kind: "not_found" })
	})

	it("CAP-015-S59 does not release a file of a draft of another user", () => {
		const file = storedFile({ state: ACQUISITION_STATE.DRAFT, operator_user_id: OTHER_USER })

		expect(fileOutcomeOf(file, CLINICIAN, FILE_PART.ORIGINAL)).toEqual({ kind: "not_found" })
	})

	it("CAP-020-S29 does not release a file outside the role scope", () => {
		expect(fileOutcomeOf(storedFile(), OTHER_DEPARTMENT_CLINICIAN, FILE_PART.ORIGINAL)).toEqual({ kind: "not_found" })
	})

	it("CAP-015-R36 does not release an announced, rejected or removed file", () => {
		for (const status of [FILE_STATUS.ANNOUNCED, FILE_STATUS.REJECTED, FILE_STATUS.REMOVED]) {
			expect(fileOutcomeOf(storedFile({ status }), CLINICIAN, FILE_PART.ORIGINAL)).toEqual({ kind: "not_found" })
		}
	})

	it("answers an unknown file as not found", () => {
		expect(fileOutcomeOf(undefined, CLINICIAN, FILE_PART.ORIGINAL)).toEqual({ kind: "not_found" })
	})

	it("CAP-020-S30 answers an original past its retention as gone while the thumbnail stays", () => {
		const file = storedFile({ binary_object_id: null })

		expect(fileOutcomeOf(file, CLINICIAN, FILE_PART.ORIGINAL)).toEqual({ kind: "gone" })
		expect(fileOutcomeOf(file, CLINICIAN, FILE_PART.THUMBNAIL)).toEqual({
			kind: "release",
			binaryObjectId: THUMBNAIL_OBJECT,
			clinicalRecordBinaryId: STORED_THUMBNAIL,
			rendition: null,
		})
	})

	it("CAP-026-R18 CAP-020-S28 links an original without its buffer copy to the clinical record store, not as gone", () => {
		const file = storedFile({ buffer_deleted_at: BUFFER_CLEANUP_MOMENT })

		expect(fileOutcomeOf(file, CLINICIAN, FILE_PART.ORIGINAL)).toEqual({
			kind: "link",
			clinicalRecordBinaryId: STORED_ORIGINAL,
			rendition: "original",
		})
		expect(fileOutcomeOf(file, CLINICIAN, FILE_PART.THUMBNAIL)).toEqual({
			kind: "release",
			binaryObjectId: THUMBNAIL_OBJECT,
			clinicalRecordBinaryId: STORED_THUMBNAIL,
			rendition: null,
		})
	})

	it("CAP-026-R02 links a thumbnail without its buffer copy to the clinical record store", () => {
		const file = storedFile({ thumbnail_buffer_deleted_at: BUFFER_CLEANUP_MOMENT })

		expect(fileOutcomeOf(file, CLINICIAN, FILE_PART.THUMBNAIL)).toEqual({
			kind: "link",
			clinicalRecordBinaryId: STORED_THUMBNAIL,
			rendition: null,
		})
	})

	it("CAP-020-R15 releases the viewing copy in place of an original past its retention", () => {
		const file = storedFile({
			binary_object_id: null,
			viewing_copy_binary_object_id: VIEWING_COPY_OBJECT,
			viewing_copy_buffer_deleted_at: BUFFER_CLEANUP_MOMENT,
			viewing_copy_clinical_record_binary_id: STORED_VIEWING_COPY,
		})

		expect(fileOutcomeOf(file, CLINICIAN, FILE_PART.ORIGINAL)).toEqual({
			kind: "link",
			clinicalRecordBinaryId: STORED_VIEWING_COPY,
			rendition: "viewing_copy",
		})
	})

	it("CAP-020-R15 keeps releasing the original while it is stored, not its viewing copy", () => {
		const file = storedFile({
			viewing_copy_binary_object_id: VIEWING_COPY_OBJECT,
			viewing_copy_clinical_record_binary_id: STORED_VIEWING_COPY,
		})

		expect(fileOutcomeOf(file, CLINICIAN, FILE_PART.ORIGINAL)).toMatchObject({ rendition: "original" })
	})

	it("CAP-020-S31 answers a file neither buffered nor confirmed in the store as unavailable", () => {
		const file = storedFile({ buffer_deleted_at: BUFFER_CLEANUP_MOMENT, clinical_record_binary_id: null })

		expect(fileOutcomeOf(file, CLINICIAN, FILE_PART.ORIGINAL)).toEqual({ kind: "source_unavailable" })
	})
})
