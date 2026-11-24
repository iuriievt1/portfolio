import { describe, expect, it } from "vitest"
import { PduLengthError, PROFILE_MAX_PDU_LENGTH } from "../pdu"
import { ChannelError } from "../suite/channel"
import { connectivity } from "../suite/connectivity"
import { EchoError, echo } from "../suite/echo"
import { CALLING_AE_TITLE, HOSTILE_IMPLEMENTATION_CLASS_UID } from "../synthetic"
import { IMPLICIT_VR_LITTLE_ENDIAN } from "../uids"
import { hostileDuplex as hostilePeer, RESET_MESSAGE } from "./support"

const TIMEOUT_MS = 1000
const SHORT_TIMEOUT_MS = 50
const HOSTILE_PORT = 11_112

describe("suite client C-ECHO PS3.7 9.1.5, integrace-dicom.md 11", () => {
	it("goes through association, C-ECHO and release", async () => {
		expect(await echo(hostilePeer(), CALLING_AE_TITLE, "BASELINE", TIMEOUT_MS)).toEqual({
			acceptedTransferSyntax: IMPLICIT_VR_LITTLE_ENDIAN,
			peerMaxPduLength: PROFILE_MAX_PDU_LENGTH,
			peerImplementationClassUid: HOSTILE_IMPLEMENTATION_CLASS_UID,
			status: 0,
		})
	})

	it("reports a rejected association with its result, source and reason", async () => {
		await expect(echo(hostilePeer(), CALLING_AE_TITLE, "NO-SUCH-CASE", TIMEOUT_MS)).rejects.toThrow(
			new EchoError("A-ASSOCIATE: association rejected 1/1/7"),
		)
	})

	it("integrace-dicom.md 6.3 refuses an A-ASSOCIATE-AC over 16384 bytes from its header alone", async () => {
		await expect(echo(hostilePeer(), CALLING_AE_TITLE, "AC-OVERSIZE", TIMEOUT_MS)).rejects.toBeInstanceOf(
			PduLengthError,
		)
	})

	it("integrace-dicom.md 3 refuses a transfer syntax it did not propose", async () => {
		await expect(echo(hostilePeer(), CALLING_AE_TITLE, "AC-UNPROPOSED-TS", TIMEOUT_MS)).rejects.toThrow(
			/was not proposed/,
		)
	})

	it("integrace-dicom.md 8.1 refuses a response to another message", async () => {
		await expect(echo(hostilePeer(), CALLING_AE_TITLE, "RSP-FOREIGN-ID", TIMEOUT_MS)).rejects.toThrow(
			/unexpected response/,
		)
	})

	it("integrace-dicom.md 6.3 gives up when the peer does not answer", async () => {
		await expect(echo(hostilePeer(), CALLING_AE_TITLE, "NO-RESPONSE", SHORT_TIMEOUT_MS)).rejects.toBeInstanceOf(
			ChannelError,
		)
	})
})

describe("connectivity check ADR-017, Q-041", () => {
	it("passes when every peer answers C-ECHO with success", async () => {
		const result = await connectivity(
			[{ peer: "hostile", aeTitle: "BASELINE", host: "hostile", port: HOSTILE_PORT }],
			CALLING_AE_TITLE,
			async () => hostilePeer(),
			TIMEOUT_MS,
		)

		expect(result.result).toBe("pass")
		expect(result.peers).toMatchObject([
			{ target: "BASELINE@hostile", result: "pass", statusHex: "0000", peerMaxPduLength: PROFILE_MAX_PDU_LENGTH },
		])
	})

	it("fails and keeps the reason when one peer does not answer", async () => {
		const result = await connectivity(
			[
				{ peer: "hostile", aeTitle: "BASELINE", host: "hostile", port: HOSTILE_PORT },
				{ peer: "hostile", aeTitle: "RESET-ON-RQ", host: "hostile", port: HOSTILE_PORT },
				{ peer: "hostile", aeTitle: "NO-SUCH-CASE", host: "hostile", port: HOSTILE_PORT },
			],
			CALLING_AE_TITLE,
			async () => hostilePeer(),
			SHORT_TIMEOUT_MS,
		)

		expect(result.result).toBe("fail")
		expect(result.peers.map((peer) => peer.result)).toEqual(["pass", "fail", "fail"])
		expect(result.peers[1]).toMatchObject({ reason: RESET_MESSAGE })
		expect(result.peers[2]).toMatchObject({ reason: "A-ASSOCIATE: association rejected 1/1/7" })
	})

	it("fails when the connection cannot be opened", async () => {
		const result = await connectivity(
			[{ peer: "amis", aeTitle: "AMIS", host: "amis", port: HOSTILE_PORT }],
			CALLING_AE_TITLE,
			async () => {
				throw new Error("connect ECONNREFUSED")
			},
			TIMEOUT_MS,
		)

		expect(result.peers).toMatchObject([{ result: "fail", reason: "connect ECONNREFUSED" }])
	})
})
