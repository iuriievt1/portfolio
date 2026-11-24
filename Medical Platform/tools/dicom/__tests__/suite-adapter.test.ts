import { CANCEL_REASON, DIMSE_PHASE, type FindFinal } from "@ansora/vulna-adapter-dicom-dimse"
import { Dataset } from "@veevoy/dcmjs-dimse"
import { describe, expect, it } from "vitest"
import { STATUS } from "../dimse"
import { cancelProblem, confirmed, type Expectation, finalFindStatus, metaOf, renewed } from "../suite/adapter"
import { FIND_CANCELLED_GOLDEN, FIND_SUCCESS_GOLDEN } from "../suite/status-golden"
import type { WireConnection } from "../suite/wire-records"
import { JPEG_BASELINE, SECONDARY_CAPTURE_IMAGE_STORAGE } from "../uids"
import { hexWord } from "../wire/recorder"
import { part10Bytes } from "./part10"

// integrace-dicom.md 9.1, 11.1, PS3.10 7.1, PS3.5 9.1

const PIXEL_BYTES = 100
const UID_PATTERN = /^2\.25\.[1-9][0-9]*$/
const PEER = "hostile"
const CANCEL_AFTER_MATCHES = 2

function smokePart10(sopInstanceUid = Dataset.generateDerivedUid(), patientId = "SYNTHETIC-0001"): Buffer {
	return part10Bytes({
		sopClassUid: SECONDARY_CAPTURE_IMAGE_STORAGE,
		sopInstanceUid,
		transferSyntaxUid: JPEG_BASELINE,
		patientId,
		pixels: Buffer.alloc(PIXEL_BYTES, 0x41),
	})
}

function connection(index: number, calledAeTitle: string, statuses: readonly number[] = []): WireConnection {
	return {
		connection: index,
		peer: PEER,
		association: { request: { calledAeTitle } },
		messages: statuses.map((status) => ({
			direction: "peer-to-client",
			command: { commandField: hexWord(0x80_20), statusHex: hexWord(status) },
		})),
	} as unknown as WireConnection
}

function expectation(calledAeTitle: string, check: Expectation["check"] = () => undefined): Expectation {
	return {
		name: `find ${calledAeTitle}`,
		peer: PEER,
		calledAeTitle,
		check,
		reason: undefined,
		statusHex: undefined,
		classification: undefined,
	}
}

function cancelledFinal(statusHex: string, classification = FIND_CANCELLED_GOLDEN): FindFinal {
	return {
		phase: DIMSE_PHASE.RESPONSE,
		statusHex,
		complete: false,
		matchesAfterCancel: 1,
		droppedAfterCancel: 1,
		cancelReason: CANCEL_REASON.MAX_MATCHES,
		classification,
	} as FindFinal
}

describe("the adapter checks of the DICOM suite", () => {
	it("PS3.10 7.1 reads the file meta and where the data set starts", () => {
		const sopInstanceUid = Dataset.generateDerivedUid()
		const part10 = smokePart10(sopInstanceUid)
		const meta = metaOf(part10)

		expect(meta).toMatchObject({
			sopClassUid: SECONDARY_CAPTURE_IMAGE_STORAGE,
			sopInstanceUid,
			transferSyntaxUid: JPEG_BASELINE,
		})
		expect(part10.subarray(meta.datasetOffset)).toEqual(Dataset.fromStoredPart10(part10).getStoredDataset())
		expect(() => metaOf(Buffer.alloc(PIXEL_BYTES))).toThrow("not a part10 file")
	})

	it("PS3.5 9.1 renews the instance UID with one of the same length everywhere it is and nothing else", () => {
		const sopInstanceUid = Dataset.generateDerivedUid()
		const patientId = `X${sopInstanceUid.slice(0, -1)}`
		const part10 = smokePart10(sopInstanceUid, patientId)
		const renewedPart10 = renewed(part10)
		const meta = metaOf(renewedPart10)
		const dataset = Dataset.fromStoredPart10(renewedPart10)

		expect(renewedPart10.length).toBe(part10.length)
		expect(meta.sopInstanceUid).not.toBe(sopInstanceUid)
		expect(meta.sopInstanceUid).toHaveLength(sopInstanceUid.length)
		expect(meta.sopInstanceUid).toMatch(UID_PATTERN)
		expect(dataset.getElement("SOPInstanceUID")).toBe(meta.sopInstanceUid)
		expect(renewedPart10.includes(Buffer.from(patientId, "latin1"))).toBe(true)
		expect(renewedPart10.includes(Buffer.from(sopInstanceUid, "latin1"))).toBe(false)
	})

	it("integrace-dicom.md 9.1 pairs each operation with the connection to its called AE title, in any order", () => {
		const cases = confirmed(
			[expectation("FIND-A700"), expectation("FIND-FE00", () => "wrong"), expectation("FIND-C000")],
			() => [connection(2, "FIND-FE00"), connection(1, "FIND-A700"), connection(3, "STORE-0000")],
		)

		expect(cases).toEqual([
			{ name: "find FIND-A700", peer: PEER, result: "pass" },
			{ name: "find FIND-FE00", peer: PEER, result: "fail", reason: "wrong" },
			{ name: "find FIND-C000", peer: PEER, result: "fail", reason: "no connection to FIND-C000 on the wire" },
			{ name: `wire ${PEER}`, peer: PEER, result: "fail", reason: "1 connections on the wire without an operation" },
		])
	})

	it("PS3.4 C.4.1.1.4 takes the last status that is not pending as the final one", () => {
		expect(finalFindStatus(connection(1, "AMIS", [STATUS.PENDING, STATUS.PENDING_WARNING, STATUS.SUCCESS]))).toBe(
			hexWord(STATUS.SUCCESS),
		)
		expect(finalFindStatus(connection(1, "AMIS", [STATUS.PENDING]))).toBeUndefined()
	})

	it("ADR-003 ř. 29 integrace-dicom.md 6.4 takes a query cancelled at the match limit as incomplete", () => {
		expect(cancelProblem(cancelledFinal(hexWord(STATUS.SUCCESS)), CANCEL_AFTER_MATCHES)).toBeUndefined()
		expect(cancelProblem(cancelledFinal(hexWord(STATUS.SUCCESS), FIND_SUCCESS_GOLDEN), CANCEL_AFTER_MATCHES)).toMatch(
			/classified as success/,
		)
		expect(cancelProblem(cancelledFinal(hexWord(STATUS.SUCCESS)), CANCEL_AFTER_MATCHES + 1)).toMatch(/after 3 matches/)
		expect(cancelProblem(cancelledFinal(hexWord(0xa7_00)), CANCEL_AFTER_MATCHES)).toMatch(/ended as response A700/)
	})
})
