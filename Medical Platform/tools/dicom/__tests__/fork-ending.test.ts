import { constants, requests } from "@veevoy/dcmjs-dimse"
import { afterEach, describe, expect, it } from "vitest"
import { EXPLICIT_VR_LITTLE_ENDIAN } from "../uids"
import { against, closedPort, closePeers, run } from "./fork-peer"
import { syntheticImage } from "./part10"

// PS3.8 9.2.3, Q-035, integrace-dicom.md 6.2, 8.3

const STORE_BYTES = 100 * 1024
const SHORT_TIMEOUT_MS = 300
// PS3.8 9.2.3 AR-8
const LINGER_BEFORE_OWN_RELEASE_MS = 1000
const { AssociationOutcome, NotSentReason, TimeoutKind } = constants
const DONE = ["done"]
const NOT_SENT = [NotSentReason.AssociationEnded, "done"]

describe("@veevoy/dcmjs-dimse ends every association and every request in it, read from the wire by our own decoder", () => {
	afterEach(closePeers)

	it.each([
		["BASELINE", { outcome: AssociationOutcome.Released }, DONE, {}],
		["NO-SUCH-AE", { outcome: AssociationOutcome.Rejected }, NOT_SENT, {}],
		["AC-TRUNCATED", { outcome: AssociationOutcome.ClosedUnexpectedly }, NOT_SENT, {}],
		["FIN-AFTER-DATA", { outcome: AssociationOutcome.ClosedUnexpectedly }, DONE, {}],
		["RESET-ON-RQ", { outcome: AssociationOutcome.SocketError }, NOT_SENT, {}],
		["RESET-AFTER-DATA", { outcome: AssociationOutcome.SocketError }, DONE, {}],
		["ABORT-AFTER-DATA", { outcome: AssociationOutcome.AbortedByPeer }, DONE, {}],
		["ABORT-ON-RELEASE", { outcome: AssociationOutcome.AbortedByPeer }, DONE, {}],
		["PDU-UNKNOWN-TYPE", { outcome: AssociationOutcome.AbortedLocally }, NOT_SENT, {}],
		[
			"NO-RESPONSE",
			{ outcome: AssociationOutcome.AbortedLocally, timeout: TimeoutKind.Acse },
			NOT_SENT,
			{ acseTimeout: SHORT_TIMEOUT_MS },
		],
	])("Q-035 ends the association of %s as %o and the C-ECHO as %o", async (calledAeTitle, end, events, options) => {
		const { outcome } = await against(calledAeTitle, new requests.CEchoRequest(), options)

		expect(outcome.end).toEqual(end)
		expect(outcome.events).toEqual([events])
	})

	it("integrace-dicom.md 6.2 answers a release request of the peer and ends as released by the peer", async () => {
		const { outcome, record } = await against("PEER-RELEASE", new requests.CEchoRequest(), {
			associationLingerTimeout: LINGER_BEFORE_OWN_RELEASE_MS,
		})

		expect(outcome.end).toEqual({ outcome: AssociationOutcome.ReleasedByPeer })
		expect(outcome.events).toEqual([DONE])
		expect(record.clientToPeer.pduCounts["A-RELEASE-RP"]).toBe(1)
		expect(record.clientToPeer.pduCounts["A-ABORT"]).toBeUndefined()
	})

	it("integrace-dicom.md 6.2 ends a C-STORE aborted while its data set is being sent without a response, not as not sent", async () => {
		const request = new requests.CStoreRequest(syntheticImage(EXPLICIT_VR_LITTLE_ENDIAN, STORE_BYTES))
		const { outcome } = await against("ABORT-MID-DATA", request)

		expect(outcome.end).toEqual({ outcome: AssociationOutcome.AbortedByPeer })
		expect(outcome.events).toEqual([DONE])
		expect(request.getDatasetBytesSent()).toBeGreaterThan(0)
	})

	it("integrace-dicom.md 6.2 ends as not connected when nothing listens on the port", async () => {
		const outcome = await run(await closedPort(), "BASELINE", new requests.CEchoRequest())

		expect(outcome.end).toEqual({ outcome: AssociationOutcome.NotConnected })
		expect(outcome.events).toEqual([NOT_SENT])
	})
})
