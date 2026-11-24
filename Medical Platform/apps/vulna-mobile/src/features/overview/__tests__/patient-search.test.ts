import { ERROR_CODE } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { ApiProblemError } from "../../../api/api-error"
import type { Patient } from "../../../api/patients"
import { REMOTE_FAILURE } from "../../../api/remote-failure"
import {
	foundIdentifierOf,
	SEARCH_STATE,
	searchStateOfError,
	searchStateOfQuery,
	searchStateOfResult,
} from "../patient-search"

const BAD_REQUEST = 400
const UNPROCESSABLE = 422
const TOO_MANY_REQUESTS = 429
const RETRY_AFTER_SECONDS = 20
const CODE_SYSTEM = "urn:mou:birth-number"

const PATIENT: Patient = {
	patient_id: "00000000-0000-4000-8000-000000000001",
	identifiers: [
		{ system: "urn:mou:patient", value: "0098812" },
		{ system: CODE_SYSTEM, value: "991011/1234", issuer: "MOU" },
	],
	sex: null,
}

describe("searchStateOfQuery CHG-182", () => {
	it("CAP-013-S23 sends no query shorter than 3 characters and asks for more", () => {
		expect(searchStateOfQuery("99")).toEqual({ kind: SEARCH_STATE.TOO_SHORT })
		expect(searchStateOfQuery(" 9 / 9 ")).toEqual({ kind: SEARCH_STATE.TOO_SHORT })
	})

	it("searches from 3 characters on and leaves an empty field idle", () => {
		expect(searchStateOfQuery("991")).toBeUndefined()
		expect(searchStateOfQuery("   ")).toEqual({ kind: SEARCH_STATE.IDLE })
	})
})

describe("searchStateOfResult CHG-182", () => {
	it("CAP-013-S24 tells the user no patient was found", () => {
		expect(searchStateOfResult({ items: [] })).toEqual({ kind: SEARCH_STATE.NOT_FOUND })
	})

	it("CAP-013-S22 lists every match the server returned and opens none", () => {
		const other = { ...PATIENT, patient_id: "00000000-0000-4000-8000-000000000002" }

		expect(searchStateOfResult({ items: [PATIENT, other] })).toEqual({
			kind: SEARCH_STATE.FOUND,
			patients: [PATIENT, other],
		})
	})
})

describe("searchStateOfError CHG-182", () => {
	it("CAP-013-S25 asks to type more of a query with more than 20 matches", () => {
		expect(searchStateOfError(new ApiProblemError(UNPROCESSABLE, ERROR_CODE.SEARCH_TOO_BROAD))).toEqual({
			kind: SEARCH_STATE.TOO_BROAD,
		})
	})

	it("CAP-013-S12 tells the user when searching may continue", () => {
		const error = new ApiProblemError(TOO_MANY_REQUESTS, ERROR_CODE.SEARCH_RATE_LIMITED, RETRY_AFTER_SECONDS)

		expect(searchStateOfError(error)).toEqual({
			kind: SEARCH_STATE.RATE_LIMITED,
			retryAfterSeconds: RETRY_AFTER_SECONDS,
		})
	})

	it("CAP-013-S23 shows the same hint when the server refuses a short query", () => {
		expect(searchStateOfError(new ApiProblemError(BAD_REQUEST, ERROR_CODE.SEARCH_QUERY_TOO_SHORT))).toEqual({
			kind: SEARCH_STATE.TOO_SHORT,
		})
	})

	it("CAP-013-S13 reads a lost connection as no connection, not as a missing patient", () => {
		expect(searchStateOfError(new TypeError("Network request failed"))).toEqual({
			kind: SEARCH_STATE.FAILED,
			failure: REMOTE_FAILURE.NO_CONNECTION,
		})
	})
})

describe("foundIdentifierOf CHG-182", () => {
	it("CAP-013-R12 shows the identifier of the code system the query matched, with its issuer", () => {
		expect(foundIdentifierOf(PATIENT, CODE_SYSTEM, "99101112")).toEqual({ value: "991011/1234", issuer: "MOU" })
	})

	it("falls back to the first identifier of a patient without a matching one", () => {
		expect(foundIdentifierOf(PATIENT, "urn:other", "991")).toEqual({ value: "0098812", issuer: undefined })
	})
})
