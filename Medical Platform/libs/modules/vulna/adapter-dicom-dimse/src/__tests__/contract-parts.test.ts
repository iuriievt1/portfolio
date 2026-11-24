import { Client, constants } from "@veevoy/dcmjs-dimse"
import { afterEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_TIMEOUTS, openSession, type SessionEnd, unopenedEnd } from "../association-session"
import {
	ASSOCIATION_OUTCOME,
	type AssociationOutcome,
	DIMSE_PHASE,
	INFORMATION_MODEL,
	NOT_SENT_REASON,
	TIMEOUT_KIND,
} from "../contract"
import { findRequestOf } from "../find-stream"
import { identifierJsonOf } from "../identifier-json"
import { attemptOf, errorCommentOf, noAnswer, notSentReasonOf, phaseOf, statusHexOf, unsentAttempt } from "../phase"

// integrace-dicom.md 5.7, 6.2, 6.3, 6.4, 8.1, 8.3, dorucovaci-jadro.md 5

const TARGET = { host: "127.0.0.1", port: 104, callingAeTitle: "VULNA", calledAeTitle: "BASELINE" }
const IDENTITY = { implementationClassUid: "2.25.1" }

function endedAs(outcome: AssociationOutcome, abortedByUs: boolean): SessionEnd {
	const end = unopenedEnd(performance.now())
	return { ...end, association: { ...end.association, outcome }, abortedByUs }
}

describe("parts of the DimseClient contract", () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("integrace-dicom.md 6.2 knows every way the fork ends an association and every timeout", () => {
		expect(Object.values(constants.AssociationOutcome).sort()).toEqual(Object.values(ASSOCIATION_OUTCOME).sort())
		expect(Object.values(constants.TimeoutKind).sort()).toEqual(Object.values(TIMEOUT_KIND).sort())
	})

	it("integrace-dicom.md 6.3 konfigurace-a-profily.md 2.7 gives the fork every default timeout not set", () => {
		const send = vi.spyOn(Client.prototype, "send").mockImplementation(() => undefined)
		openSession({ ...TARGET, timeouts: { connectMs: undefined, dimseMs: 7 } }, IDENTITY, () => undefined, undefined)

		expect(send.mock.calls[0]?.[4]).toMatchObject({
			connectTimeout: DEFAULT_TIMEOUTS.connectMs,
			acseTimeout: DEFAULT_TIMEOUTS.acseMs,
			dimseTimeout: 7,
			idleTimeout: DEFAULT_TIMEOUTS.idleMs,
		})
	})

	it("integrace-dicom.md 6.2 ADR-005 ř. 33 takes a response first, then one byte sent as unknown", () => {
		expect(phaseOf(true, 0)).toBe(DIMSE_PHASE.RESPONSE)
		expect(phaseOf(true, 10)).toBe(DIMSE_PHASE.RESPONSE)
		expect(phaseOf(false, 1)).toBe(DIMSE_PHASE.UNKNOWN)
		expect(phaseOf(false, 0)).toBe(DIMSE_PHASE.NOT_SENT)
	})

	it("integrace-dicom.md 6.2 gives the status as four upper case hexadecimal digits", () => {
		expect(statusHexOf(0)).toBe("0000")
		expect(statusHexOf(0xc0_02)).toBe("C002")
		expect(statusHexOf(0x1_22)).toBe("0122")
		expect(statusHexOf(0xff_01)).toBe("FF01")
	})

	it("takes an empty error comment as none", () => {
		expect(errorCommentOf(undefined)).toBeUndefined()
		expect(errorCommentOf("")).toBeUndefined()
		expect(errorCommentOf("SYNTHETIC")).toBe("SYNTHETIC")
	})

	it("integrace-dicom.md 6.2 dorucovaci-jadro.md 5 says why nothing was sent", () => {
		const connected = endedAs(ASSOCIATION_OUTCOME.ABORTED_LOCALLY, false)

		expect(notSentReasonOf(connected, constants.NotSentReason.NoAcceptedPresentationContext)).toBe(
			NOT_SENT_REASON.NO_ACCEPTED_TRANSFER_SYNTAX,
		)
		expect(notSentReasonOf(connected, constants.NotSentReason.StoredDatasetUnavailable)).toBe(
			NOT_SENT_REASON.ARTIFACT_INTEGRITY,
		)
		expect(notSentReasonOf(connected, constants.NotSentReason.TransferSyntaxMismatch)).toBe(
			NOT_SENT_REASON.ARTIFACT_INTEGRITY,
		)
		expect(notSentReasonOf(connected, constants.NotSentReason.CharacterSetMismatch)).toBe(NOT_SENT_REASON.INVALID_QUERY)
		expect(notSentReasonOf(endedAs(ASSOCIATION_OUTCOME.REJECTED, false), undefined)).toBe(
			NOT_SENT_REASON.ASSOCIATION_REJECTED,
		)
		expect(notSentReasonOf(endedAs(ASSOCIATION_OUTCOME.NOT_CONNECTED, false), undefined)).toBe(
			NOT_SENT_REASON.CONNECT_FAILED,
		)
		expect(notSentReasonOf(endedAs(ASSOCIATION_OUTCOME.CONNECT_TIMEOUT, false), undefined)).toBe(
			NOT_SENT_REASON.CONNECT_FAILED,
		)
		expect(notSentReasonOf(connected, undefined)).toBe(NOT_SENT_REASON.CLOSED_BEFORE_DATA)
		expect(notSentReasonOf(endedAs(ASSOCIATION_OUTCOME.ABORTED_BY_PEER, false), undefined)).toBe(
			NOT_SENT_REASON.CLOSED_BEFORE_DATA,
		)
	})

	it("dorucovaci-jadro.md 5 takes an attempt ended by our own abort as no unavailability of the PACS", () => {
		for (const outcome of [ASSOCIATION_OUTCOME.ABORTED_LOCALLY, ASSOCIATION_OUTCOME.NOT_CONNECTED]) {
			expect(notSentReasonOf(endedAs(outcome, true), undefined)).toBe(NOT_SENT_REASON.ABORTED_BEFORE_CONNECT)
		}
		expect(notSentReasonOf(endedAs(ASSOCIATION_OUTCOME.REJECTED, true), undefined)).toBe(
			NOT_SENT_REASON.ASSOCIATION_REJECTED,
		)
	})

	it("integrace-dicom.md 6.2 builds one attempt from the end, the answer and the bytes sent", () => {
		const end = endedAs(ASSOCIATION_OUTCOME.RELEASED, false)
		const answer = { ...noAnswer(), status: 0xb0_07, errorComment: "SYNTHETIC" }

		expect(attemptOf(end, answer, 1)).toEqual({
			phase: DIMSE_PHASE.RESPONSE,
			notSentReason: undefined,
			status: 0xb0_07,
			statusHex: "B007",
			errorComment: "SYNTHETIC",
			rejection: undefined,
		})
		expect(attemptOf(end, noAnswer(), 1)).toMatchObject({ phase: DIMSE_PHASE.UNKNOWN, notSentReason: undefined })
		expect(attemptOf(end, noAnswer(), 0)).toMatchObject({
			phase: DIMSE_PHASE.NOT_SENT,
			notSentReason: NOT_SENT_REASON.CLOSED_BEFORE_DATA,
		})
		expect(unsentAttempt(NOT_SENT_REASON.ARTIFACT_INTEGRITY)).toMatchObject({
			phase: DIMSE_PHASE.NOT_SENT,
			notSentReason: NOT_SENT_REASON.ARTIFACT_INTEGRITY,
			status: undefined,
		})
	})

	it("integrace-dicom.md 5.7, 6.4 asks in ISO_IR 192 with the SOP class of the information model", () => {
		const identifier = { QueryRetrieveLevel: "PATIENT", PatientName: "Šťastná*", SpecificCharacterSet: "ISO_IR 100" }
		const sopClasses = [
			[INFORMATION_MODEL.PATIENT_ROOT, "1.2.840.10008.5.1.4.1.2.1.1"],
			[INFORMATION_MODEL.STUDY_ROOT, "1.2.840.10008.5.1.4.1.2.2.1"],
			[INFORMATION_MODEL.MODALITY_WORKLIST, "1.2.840.10008.5.1.4.31"],
		] as const

		for (const [informationModel, sopClassUid] of sopClasses) {
			const request = findRequestOf({ informationModel, identifier })

			expect(request.getAffectedSopClassUid()).toBe(sopClassUid)
			expect(request.getDataset()?.getElement("SpecificCharacterSet")).toBe("ISO_IR 192")
			expect(request.getDataset()?.getElement("PatientName")).toBe("Šťastná*")
		}
		expect(() => findRequestOf({ informationModel: "raw" as never, identifier })).toThrow(RangeError)
	})

	it("integrace-dicom.md 6 gives the identifier as plain JSON without the library's keys and character set", () => {
		const bytes = new Uint8Array([1, 2, 3])
		const identifier = identifierJsonOf({
			_vrMap: { PixelData: "OB" },
			SpecificCharacterSet: "ISO_IR 192",
			PatientName: [{ Alphabetic: "SYNTHETIC^ONE" }],
			ProcedureCodeSequence: [{ CodeValue: "XR", _vrMap: {}, SpecificCharacterSet: "ISO_IR 192" }],
			Binary: bytes.buffer,
			View: bytes.subarray(1),
			Missing: null,
		})

		expect(identifier).toEqual({
			PatientName: [{ Alphabetic: "SYNTHETIC^ONE" }],
			ProcedureCodeSequence: [{ CodeValue: "XR", SpecificCharacterSet: "ISO_IR 192" }],
			Binary: "AQID",
			View: "AgM=",
			Missing: null,
		})
		expect(JSON.parse(JSON.stringify(identifier))).toEqual(identifier)
	})
})
