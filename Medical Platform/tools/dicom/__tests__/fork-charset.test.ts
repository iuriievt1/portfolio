import { constants, requests } from "@veevoy/dcmjs-dimse"
import { afterEach, describe, expect, it } from "vitest"
import { COMMAND_FIELD, STATUS } from "../dimse"
import {
	ASCII_PATIENT_NAME,
	LATIN1_PATIENT_NAME,
	NESTED_UTF8_CODE_MEANING,
	NESTED_UTF8_PATIENT_NAME,
} from "../hostile/cases"
import { SYNTHETIC_PATIENT_ID } from "../synthetic"
import { hexWord } from "../wire/recorder"
import { against, closePeers } from "./fork-peer"

// PS3.5 6.1.2.3, 7.5.3, Q-035, CAP-024-R11, integrace-dicom.md 5.7, 6.4

const C_FIND_RQ = hexWord(COMMAND_FIELD.C_FIND_RQ)
const DIACRITICS_QUERY = "Šťastná*"
const UTF8_CHARACTER_SET = "ISO_IR 192"

function studyFind(elements: Record<string, string> = { PatientID: SYNTHETIC_PATIENT_ID }): requests.Request {
	return requests.CFindRequest.createStudyFindRequest(elements)
}

describe("@veevoy/dcmjs reads text in sequence items with the data set character set, from bytes of our own encoder", () => {
	afterEach(closePeers)

	it("Q-035 decodes ISO_IR 192 text at the top level and in a sequence item (dcmjs #508)", async () => {
		const { outcome } = await against("FIND-NESTED-UTF8", studyFind())
		const [dataset] = outcome.datasets
		const procedureCodes = dataset?.getElement("ProcedureCodeSequence") as { CodeMeaning: string }[] | undefined
		const patientName = dataset?.getElement("PatientName") as { Alphabetic: string }[] | undefined

		expect(outcome.networkError).toBeUndefined()
		expect(outcome.statuses).toEqual([STATUS.PENDING, STATUS.SUCCESS])
		expect(patientName?.[0]?.Alphabetic).toBe(NESTED_UTF8_PATIENT_NAME)
		expect(procedureCodes?.[0]?.CodeMeaning).toBe(NESTED_UTF8_CODE_MEANING)
		expect(dataset?.getReceivedSpecificCharacterSet()).toBe(UTF8_CHARACTER_SET)
	})

	it.each([
		["FIND-LATIN1", LATIN1_PATIENT_NAME, "ISO_IR 100"],
		["FIND-NO-CHARSET", ASCII_PATIENT_NAME, undefined],
	])(
		"integrace-dicom.md 6.4 decodes %s and keeps its Specific Character Set as it came",
		async (calledAeTitle, name, characterSet) => {
			const { outcome } = await against(calledAeTitle, studyFind())
			const [dataset] = outcome.datasets
			const patientName = dataset?.getElement("PatientName") as { Alphabetic: string }[] | undefined

			expect(outcome.networkError).toBeUndefined()
			expect(outcome.statuses).toEqual([STATUS.PENDING, STATUS.SUCCESS])
			expect(patientName?.[0]?.Alphabetic).toBe(name)
			expect(dataset?.getReceivedSpecificCharacterSet()).toBe(characterSet)
		},
	)
})

describe("@veevoy/dcmjs-dimse sends no query whose text is outside its character set, read from the wire by our own decoder", () => {
	afterEach(closePeers)

	async function queried(elements: Record<string, string>) {
		const { outcome, record } = await against("BASELINE", studyFind(elements))
		const finds = record.messages.filter(
			(message) => message.direction === "client-to-peer" && message.command?.commandField === C_FIND_RQ,
		)
		return { outcome, finds }
	}

	it("integrace-dicom.md 6.4 sends no C-FIND with diacritics but without ISO_IR 192", async () => {
		const { outcome, finds } = await queried({ PatientName: DIACRITICS_QUERY })

		expect(outcome.events).toEqual([[constants.NotSentReason.CharacterSetMismatch, "done"]])
		expect(finds).toHaveLength(0)
	})

	it("integrace-dicom.md 5.7 sends the C-FIND with diacritics and ISO_IR 192", async () => {
		const { outcome, finds } = await queried({
			SpecificCharacterSet: UTF8_CHARACTER_SET,
			PatientName: DIACRITICS_QUERY,
		})

		expect(outcome.events).toEqual([["done"]])
		expect(outcome.statuses).toEqual([STATUS.SUCCESS])
		expect(finds).toHaveLength(1)
		expect(finds[0]?.dataset?.bytes).toBeGreaterThan(0)
	})
})
