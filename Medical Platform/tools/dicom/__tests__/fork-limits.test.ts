import { constants, requests } from "@veevoy/dcmjs-dimse"
import { afterEach, describe, expect, it } from "vitest"
import { COMMAND_FIELD } from "../dimse"
import { PROFILE_MAX_PDU_LENGTH } from "../pdu"
import { EXPLICIT_VR_LITTLE_ENDIAN } from "../uids"
import { hexWord } from "../wire/recorder"
import { against, closePeers, providerAbort } from "./fork-peer"
import { syntheticImage } from "./part10"

// ADR-005 ř. 33, 39, ADR-017, integrace-dicom.md 6.3, 8.3, 10, 11

const C_ECHO_RQ = hexWord(COMMAND_FIELD.C_ECHO_RQ)
const C_STORE_RQ = hexWord(COMMAND_FIELD.C_STORE_RQ)
const STORE_BYTES = 100 * 1024
const SHORT_TIMEOUT_MS = 300
const LONG_TIMEOUT_MS = 120_000
const STALLED_STORE_BYTES = 24 * 1024 * 1024
const STALLED_STORE_TEST_MS = 20_000

describe("@veevoy/dcmjs-dimse PDU limits and timeouts against the hostile peer, read from the wire by our own decoder", () => {
	afterEach(closePeers)

	it("integrace-dicom.md 10 announces 16384 and sends no P-DATA-TF over the 16384 the peer announced", async () => {
		const { outcome, record } = await against(
			"BASELINE",
			new requests.CStoreRequest(syntheticImage(EXPLICIT_VR_LITTLE_ENDIAN, STORE_BYTES)),
		)

		expect(outcome.networkError).toBeUndefined()
		expect(record.association.request?.maxPduLength).toBe(PROFILE_MAX_PDU_LENGTH)
		expect(record.association.accept?.maxPduLength).toBe(PROFILE_MAX_PDU_LENGTH)
		expect(record.clientToPeer.maxDataPduLength).toBe(PROFILE_MAX_PDU_LENGTH)
	})

	it("integrace-dicom.md 6.3 refuses an oversized A-ASSOCIATE-AC from its header and aborts", async () => {
		const { outcome, record } = await against("AC-OVERSIZE", new requests.CEchoRequest())

		expect(outcome.networkError?.message).toMatch(/PDU length 4294967295 \[type: 2\] exceeds the maximum 16384/)
		expect(record.association.abort).toEqual(providerAbort(constants.AbortReason.InvalidPduParameter))
		expect(record.clientToPeer.pduCounts["P-DATA-TF"]).toBeUndefined()
	})

	it("integrace-dicom.md 6.3 refuses an oversized P-DATA-TF from its header and aborts", async () => {
		const { outcome, record } = await against("PDATA-OVERSIZE", new requests.CEchoRequest())

		expect(outcome.networkError?.message).toMatch(/PDU length 4294967280 \[type: 4\] exceeds the maximum 16384/)
		expect(outcome.statuses).toEqual([])
		expect(record.association.abort).toEqual(providerAbort(constants.AbortReason.InvalidPduParameter))
	})

	it("aborts on a PDU of an undefined type", async () => {
		const { outcome, record } = await against("PDU-UNKNOWN-TYPE", new requests.CEchoRequest())

		expect(outcome.networkError?.message).toMatch(/Unknown PDU type: 10/)
		expect(record.association.abort).toEqual(providerAbort(constants.AbortReason.UnrecognizedPdu))
	})

	it("integrace-dicom.md 6.3 aborts on the ACSE timeout when the peer never answers the association request", async () => {
		const { outcome, record } = await against("NO-RESPONSE", new requests.CEchoRequest(), {
			acseTimeout: SHORT_TIMEOUT_MS,
		})

		expect(outcome.networkError?.timeout).toBe(constants.TimeoutKind.Acse)
		expect(record.association.abort?.by).toBe("client-to-peer")
	})

	it("integrace-dicom.md 6.3 aborts on the DIMSE timeout when the peer never answers the request", async () => {
		const { outcome, record } = await against("MUTE-AFTER-DATA", new requests.CEchoRequest(), {
			dimseTimeout: SHORT_TIMEOUT_MS,
		})
		const echoes = record.messages.filter(
			(message) => message.direction === "client-to-peer" && message.command?.commandField === C_ECHO_RQ,
		)

		expect(outcome.networkError?.timeout).toBe(constants.TimeoutKind.Dimse)
		expect(echoes.map((message) => message.complete)).toEqual([true])
		expect(record.association.abort?.by).toBe("client-to-peer")
	})

	it(
		"integrace-dicom.md 6.3 aborts a send the peer stopped reading on the idle timeout, not the DIMSE timeout",
		async () => {
			const { outcome, record } = await against(
				"STALL-READ",
				new requests.CStoreRequest(syntheticImage(EXPLICIT_VR_LITTLE_ENDIAN, STALLED_STORE_BYTES)),
				{ idleTimeout: SHORT_TIMEOUT_MS, dimseTimeout: LONG_TIMEOUT_MS },
			)
			const completeStores = record.messages.filter(
				(message) =>
					message.direction === "client-to-peer" && message.command?.commandField === C_STORE_RQ && message.complete,
			)

			expect(outcome.networkError?.timeout).toBe(constants.TimeoutKind.Idle)
			expect(completeStores).toEqual([])
		},
		STALLED_STORE_TEST_MS,
	)
})
