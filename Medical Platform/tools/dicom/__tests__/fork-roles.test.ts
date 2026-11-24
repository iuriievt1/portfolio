import { constants, requests } from "@veevoy/dcmjs-dimse"
import { afterEach, describe, expect, it } from "vitest"
import { against, closePeers, providerAbort, USER_ABORT } from "./fork-peer"

// ADR-003, ADR-017, integrace-dicom.md 11

describe("@veevoy/dcmjs-dimse takes only the SCU role of the association requestor, read from the wire by our own decoder", () => {
	afterEach(closePeers)

	it("aborts as the service user when the peer sends a DIMSE request", async () => {
		const { outcome, record } = await against("PEER-REQUEST", new requests.CEchoRequest())

		expect(outcome.statuses).toEqual([])
		expect(outcome.networkError?.message).toMatch(/Unexpected DIMSE message from the peer: C-ECHO RQ/)
		expect(record.association.abort).toEqual(USER_ABORT)
	})

	it("aborts as the service user on a response of a service the client does not use", async () => {
		const { outcome, record } = await against("RSP-MOVE-TYPE", new requests.CEchoRequest())

		expect(outcome.statuses).toEqual([])
		expect(outcome.networkError?.message).toMatch(/Unexpected DIMSE message from the peer: C-MOVE RSP/)
		expect(record.association.abort).toEqual(USER_ABORT)
	})

	it("aborts as the service provider on an A-ASSOCIATE-RQ from the peer", async () => {
		const { outcome, record } = await against("PEER-ASSOC-RQ", new requests.CEchoRequest())

		expect(outcome.statuses).toEqual([])
		expect(outcome.networkError?.message).toMatch(/Unexpected A-ASSOCIATE-RQ from the peer/)
		expect(record.association.abort).toEqual(providerAbort(constants.AbortReason.UnexpectedPdu))
	})
})
