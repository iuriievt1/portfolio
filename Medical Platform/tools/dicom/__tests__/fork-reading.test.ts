import { constants, requests } from "@veevoy/dcmjs-dimse"
import { afterEach, describe, expect, it } from "vitest"
import { COMMAND_FIELD } from "../dimse"
import { SYNTHETIC_PATIENT_ID } from "../synthetic"
import { hexWord } from "../wire/recorder"
import { against, closePeers, providerAbort, USER_ABORT } from "./fork-peer"

// PS3.8 9.2.3, 9.3, E.1, ADR-017, integrace-dicom.md 6.3, 11

const DEFAULT_MAX_RECEIVED_MESSAGE_LENGTH = 1024 * 1024
const C_ECHO_RQ = hexWord(COMMAND_FIELD.C_ECHO_RQ)

describe("@veevoy/dcmjs-dimse reads the PDUs of the peer strictly, read from the wire by our own decoder", () => {
	afterEach(closePeers)

	it.each([
		["AC-ITEM-OVERRUN", /Invalid A-ASSOCIATE-AC from the peer: .*runs past the bytes left/],
		["PDATA-NO-PDV", /Invalid P-DATA-TF from the peer: P-DATA-TF has no PDV/],
		["PDV-OVERRUN", /Invalid P-DATA-TF from the peer: PDV of length \d+ does not fit/],
		["PDV-FOREIGN-CTX", /PDV on presentation context \d+, which was not accepted/],
	])("aborts as the service provider, invalid-PDU-parameter value, on %s", async (calledAeTitle, message) => {
		const { outcome, record } = await against(calledAeTitle, new requests.CEchoRequest())

		expect(outcome.statuses).toEqual([])
		expect(outcome.networkError?.message).toMatch(message)
		expect(record.association.abort).toEqual(providerAbort(constants.AbortReason.InvalidPduParameter))
	})

	it("aborts as the service provider, unexpected-PDU, on a second A-ASSOCIATE-AC and sends the request at most once", async () => {
		const { outcome, record } = await against("AC-SECOND", new requests.CEchoRequest())
		const echoes = record.messages.filter(
			(wireMessage) => wireMessage.direction === "client-to-peer" && wireMessage.command?.commandField === C_ECHO_RQ,
		)

		expect(outcome.networkError?.message).toMatch(/Unexpected A-ASSOCIATE-AC from the peer/)
		expect(record.association.abort).toEqual(providerAbort(constants.AbortReason.UnexpectedPdu))
		expect(echoes.length).toBeLessThanOrEqual(1)
	})

	it("aborts as the service user on a dataset fragment before the command", async () => {
		const { outcome, record } = await against("DATA-BEFORE-CMD", new requests.CEchoRequest())

		expect(outcome.statuses).toEqual([])
		expect(outcome.networkError?.message).toMatch(/Dataset fragment without a command that announces a dataset/)
		expect(record.association.abort).toEqual(USER_ABORT)
	})

	it("aborts as the service user on a C-FIND identifier longer than the received message maximum", async () => {
		const request = requests.CFindRequest.createStudyFindRequest({ PatientID: SYNTHETIC_PATIENT_ID })
		const { outcome, record } = await against("FIND-OVERSIZE", request)

		expect(outcome.statuses).toEqual([])
		expect(outcome.networkError?.message).toMatch(
			new RegExp(`Received message exceeds the maximum length ${DEFAULT_MAX_RECEIVED_MESSAGE_LENGTH}`),
		)
		expect(record.association.abort).toEqual(USER_ABORT)
	})
})
