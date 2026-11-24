import { ERROR_CODE, PATIENT_SEX, PATIENT_TAG_SOURCE } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { ApiProblemError } from "../../../api/api-error"
import type { Patient } from "../../../api/patients"
import { REMOTE_FAILURE } from "../../../api/remote-failure"
import {
	codeIdentifierOf,
	IDENTIFICATION,
	IDENTIFICATION_NOTICE,
	identificationOf,
	noticeOfError,
	tagIdentifierOf,
} from "../patient-identifier"

const SYSTEM = "urn:vulna:synthetic:patient-id"
const SERVICE_UNAVAILABLE = 503
const TOO_MANY_REQUESTS = 429
const UNPROCESSABLE_CONTENT = 422
const RETRY_AFTER_SECONDS = 20
const PATIENT_ID_MAX_LENGTH = 64

function patientWith(patientId: string, issuer: string): Patient {
	return {
		patient_id: patientId,
		identifiers: [{ system: SYSTEM, value: "1000101", issuer }],
		sex: PATIENT_SEX.FEMALE,
	}
}

const FIRST = patientWith("00000000-0000-4000-8000-000000000001", "MOU")
const SECOND = patientWith("00000000-0000-4000-8000-000000000002", "FNBRNO")

describe("identifier from a code CAP-013-R03", () => {
	it("CAP-013-S01 takes the whole wristband code when the instance sets no pattern", () => {
		expect(codeIdentifierOf(" 1000101 ", { system: SYSTEM })).toEqual({ system: SYSTEM, value: "1000101" })
	})

	it("takes the first capturing group of the configured pattern", () => {
		expect(codeIdentifierOf("PID:1000101;ENC:77", { system: SYSTEM, pattern: "^PID:(\\d+);" })).toEqual({
			system: SYSTEM,
			value: "1000101",
		})
	})

	it("reads nothing from a code the pattern does not match", () => {
		expect(codeIdentifierOf("GTIN 8594001234567", { system: SYSTEM, pattern: "^PID:(\\d+)$" })).toBeUndefined()
	})

	it("reads nothing from an empty code", () => {
		expect(codeIdentifierOf("   ", { system: SYSTEM })).toBeUndefined()
	})

	it("reads nothing when the configured pattern does not compile", () => {
		expect(codeIdentifierOf("PID:1000101", { system: SYSTEM, pattern: "(" })).toBeUndefined()
	})
})

describe("identifier usable as a DICOM Patient ID CAP-013-R10", () => {
	it("takes a value of any structure up to the length of a DICOM Patient ID", () => {
		const longest = "R".repeat(PATIENT_ID_MAX_LENGTH)

		expect(codeIdentifierOf(longest, { system: SYSTEM })).toEqual({ system: SYSTEM, value: longest })
		expect(codeIdentifierOf("RID-ž 0042/7", { system: SYSTEM })).toEqual({ system: SYSTEM, value: "RID-ž 0042/7" })
	})

	it("CAP-013-S21 reads nothing from a code longer than a DICOM Patient ID", () => {
		expect(codeIdentifierOf("7".repeat(PATIENT_ID_MAX_LENGTH + 1), { system: SYSTEM })).toBeUndefined()
	})

	it("CAP-013-S21 reads nothing from a code with a backslash or a control character", () => {
		expect(codeIdentifierOf("1000101\\RID", { system: SYSTEM })).toBeUndefined()
		expect(codeIdentifierOf("1000101\u001d01", { system: SYSTEM })).toBeUndefined()
		expect(codeIdentifierOf("1000101\u0085", { system: SYSTEM })).toBeUndefined()
	})

	it("CAP-013-S21 reads nothing from an NFC tag with a value that cannot be a DICOM Patient ID", () => {
		const tag = { uid: undefined, ndefTexts: ["7".repeat(PATIENT_ID_MAX_LENGTH + 1)] }

		expect(tagIdentifierOf(tag, { source: PATIENT_TAG_SOURCE.NDEF_TEXT, system: SYSTEM })).toBeUndefined()
	})
})

describe("identifier from an NFC tag CAP-013-R05", () => {
	it("takes the first NDEF text when the instance maps the NDEF content", () => {
		const tag = { uid: "04A224B1C35E80", ndefTexts: ["1000101", "other"] }
		expect(tagIdentifierOf(tag, { source: PATIENT_TAG_SOURCE.NDEF_TEXT, system: SYSTEM })).toEqual({
			system: SYSTEM,
			value: "1000101",
		})
	})

	it("takes the UID when the instance maps the UID", () => {
		const tag = { uid: "04A224B1C35E80", ndefTexts: ["1000101"] }
		expect(tagIdentifierOf(tag, { source: PATIENT_TAG_SOURCE.UID, system: SYSTEM })).toEqual({
			system: SYSTEM,
			value: "04A224B1C35E80",
		})
	})

	it("CAP-013-S04 does not fall back to the UID when the tag carries no NDEF text", () => {
		const tag = { uid: "04A224B1C35E80", ndefTexts: [] }
		expect(tagIdentifierOf(tag, { source: PATIENT_TAG_SOURCE.NDEF_TEXT, system: SYSTEM })).toBeUndefined()
	})
})

describe("identification by the server answer CAP-013-R10", () => {
	it("CAP-013-S01 opens the patient detail on exactly one match", () => {
		expect(identificationOf([FIRST])).toEqual({ kind: IDENTIFICATION.OPEN, patient: FIRST })
	})

	it("CAP-013-S19 offers every match without choosing one when the identifier matches two patients", () => {
		expect(identificationOf([FIRST, SECOND])).toEqual({ kind: IDENTIFICATION.CHOOSE, patients: [FIRST, SECOND] })
	})

	it("CAP-013-R10 opens nothing when the server returns no patient", () => {
		expect(identificationOf([])).toEqual({ kind: IDENTIFICATION.NOT_FOUND })
	})
})

describe("notice of a failed identification", () => {
	it("CAP-013-S13 says that there is no connection", () => {
		expect(noticeOfError(new TypeError("Network request failed"))).toEqual({
			kind: IDENTIFICATION_NOTICE.FAILED,
			failure: REMOTE_FAILURE.NO_CONNECTION,
		})
	})

	it("CAP-013-S12 says when the identification may be repeated", () => {
		const error = new ApiProblemError(TOO_MANY_REQUESTS, ERROR_CODE.SEARCH_RATE_LIMITED, RETRY_AFTER_SECONDS)
		expect(noticeOfError(error)).toEqual({
			kind: IDENTIFICATION_NOTICE.RATE_LIMITED,
			retryAfterSeconds: RETRY_AFTER_SECONDS,
		})
	})

	it("CAP-013-S11 says that the identifier matches too many patients", () => {
		const error = new ApiProblemError(UNPROCESSABLE_CONTENT, ERROR_CODE.SEARCH_TOO_BROAD)
		expect(noticeOfError(error)).toEqual({ kind: IDENTIFICATION_NOTICE.TOO_BROAD })
	})

	it("says that the server answered with an error", () => {
		expect(noticeOfError(new ApiProblemError(SERVICE_UNAVAILABLE, undefined))).toEqual({
			kind: IDENTIFICATION_NOTICE.FAILED,
			failure: REMOTE_FAILURE.SERVER_ERROR,
		})
	})
})
