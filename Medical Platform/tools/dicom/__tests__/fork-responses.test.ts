import { constants, requests } from "@veevoy/dcmjs-dimse"
import { afterEach, describe, expect, it } from "vitest"
import { STATUS } from "../dimse"
import { SYNTHETIC_PATIENT_ID } from "../synthetic"
import { EXPLICIT_VR_LITTLE_ENDIAN } from "../uids"
import { against, closePeers, USER_ABORT } from "./fork-peer"
import { syntheticImage } from "./part10"

// PS3.4 C.4.1.1.4, PS3.7 6.3.1, 9.1.1.1, 9.1.2.1, Q-035, integrace-dicom.md 8.1, 8.2

const EARLY_ANSWERED_STORE_BYTES = 24 * 1024 * 1024
const SMALL_STORE_BYTES = 40_000

function storeRequest(pixelBytes = SMALL_STORE_BYTES): requests.Request {
	return new requests.CStoreRequest(syntheticImage(EXPLICIT_VR_LITTLE_ENDIAN, pixelBytes))
}

function findRequest(): requests.Request {
	return requests.CFindRequest.createStudyFindRequest({ PatientID: SYNTHETIC_PATIENT_ID })
}

describe("@veevoy/dcmjs-dimse takes only the responses to its own requests, read from the wire by our own decoder", () => {
	afterEach(closePeers)

	it.each([
		["RSP-FOREIGN-ID", () => new requests.CEchoRequest(), /C-ECHO RSP .* answers no outstanding request/, []],
		["RSP-FOREIGN-UID", () => storeRequest(), /names another affected SOP instance/, []],
		["RSP-OTHER-CLASS", () => storeRequest(), /names another affected SOP class/, []],
		["RSP-ECHO-TYPE", () => storeRequest(), /C-ECHO RSP .* answers C-STORE RQ/, []],
		["RSP-FIND-TYPE", () => storeRequest(), /C-FIND RSP .* answers C-STORE RQ/, []],
		["RSP-STORE-FF00", () => storeRequest(), /C-STORE RSP .* has a pending status, which only C-FIND has/, []],
		["RSP-NO-STATUS", () => new requests.CEchoRequest(), /C-ECHO RSP .* has no status/, []],
		[
			"RSP-DUPLICATE",
			() => new requests.CEchoRequest(),
			/C-ECHO RSP .* answers no outstanding request/,
			[STATUS.SUCCESS],
		],
		["FIND-FINAL-DATA", () => findRequest(), /carries a data set, which only a pending C-FIND response does/, []],
		[
			"CMD-GROUP-LENGTH",
			() => new requests.CEchoRequest(),
			/Invalid command set from the peer: command group length/,
			[],
		],
		[
			"CMD-TRUNCATED",
			() => new requests.CEchoRequest(),
			/Invalid command set from the peer: element \(0000,0902\)/,
			[],
		],
		[
			"FIND-HUGE-LENGTH",
			() => findRequest(),
			/Invalid data set from the peer: element \(0010,0010\) of length \d+ runs past/,
			[],
		],
		["FIND-DEEP-NEST", () => findRequest(), /Invalid data set from the peer: sequences nest deeper than 64/, []],
	])(
		"Q-035 aborts as the service user on %s and takes no foreign status",
		async (calledAeTitle, request, problem, statuses) => {
			const { outcome, record } = await against(calledAeTitle, request())

			expect(outcome.networkError?.message).toMatch(problem)
			expect(outcome.statuses).toEqual(statuses)
			expect(record.association.abort).toEqual(USER_ABORT)
		},
	)

	it("aborts on a response on another presentation context than the one of its request", async () => {
		const { outcome, record } = await against("RSP-OTHER-CTX", [new requests.CEchoRequest(), findRequest()])

		expect(outcome.networkError?.message).toMatch(/came on presentation context \d+, not on the one of C-ECHO RQ/)
		expect(outcome.statuses).toEqual([])
		expect(record.association.abort).toEqual(USER_ABORT)
	})

	it("integrace-dicom.md 8.1 takes no success that comes before the data set was handed to the system", async () => {
		const { outcome } = await against("RSP-EARLY-OK", storeRequest(EARLY_ANSWERED_STORE_BYTES))

		expect(outcome.networkError?.message).toMatch(/C-STORE RSP .* came before C-STORE RQ .* was sent completely/)
		expect(outcome.statuses).toEqual([])
		expect(outcome.end).toEqual({ outcome: constants.AssociationOutcome.AbortedLocally })
	})

	it("integrace-dicom.md 8.2 takes FF01 as a pending C-FIND status, not as the final one", async () => {
		const { outcome, record } = await against("FIND-FF01", findRequest())

		expect(outcome.networkError).toBeUndefined()
		expect(outcome.statuses).toEqual([STATUS.PENDING_WARNING, STATUS.SUCCESS])
		expect(record.association.abort).toBeUndefined()
	})
})
