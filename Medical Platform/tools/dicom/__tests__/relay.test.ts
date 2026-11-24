import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { type Duplex, duplexPair } from "node:stream"
import { afterEach, describe, expect, it } from "vitest"
import { PROFILE_MAX_PDU_LENGTH } from "../pdu"
import { confirmFromWire, wireEchoProblem } from "../suite/connectivity"
import { echo } from "../suite/echo"
import type { WireConnection } from "../suite/wire-records"
import { CALLING_AE_TITLE } from "../synthetic"
import { IMPLICIT_VR_LITTLE_ENDIAN } from "../uids"
import { routeDirectory } from "../wire/proxy"
import { Relay, type RelayOutcome } from "../wire/relay"
import { RESET_CODE, RESET_MESSAGE, serveHostile } from "./support"

const TIMEOUT_MS = 1000

function relayed(): { client: Duplex; relayClient: Duplex; upstream: Duplex; outcome: Promise<RelayOutcome> } {
	const [client, relayClient] = duplexPair()
	const [relayUpstream, peer] = duplexPair()
	serveHostile(peer, relayUpstream)
	const outcome = new Promise<RelayOutcome>((resolve) => {
		new Relay(relayClient, relayUpstream, resolve)
	})
	return { client, relayClient, upstream: relayUpstream, outcome }
}

function connectionOf(outcome: RelayOutcome): WireConnection {
	const { pdus: _, ...record } = outcome.record
	return {
		...record,
		connection: 1,
		peer: "hostile",
		closedBy: outcome.closedBy,
		error: outcome.error,
		pdusFile: "pdus-0001.json",
	}
}

async function echoedConnection(): Promise<WireConnection> {
	const { client, outcome } = relayed()
	await echo(client, CALLING_AE_TITLE, "BASELINE", TIMEOUT_MS)
	return connectionOf(await outcome)
}

describe("relay integrace-dicom.md 9.1, 11.1", () => {
	it("passes the association through unchanged and records it on the way", async () => {
		const connection = await echoedConnection()

		expect(connection.closedBy).toBe("peer")
		expect(connection.messages.map((message) => [message.direction, message.command?.commandField])).toEqual([
			["client-to-peer", "0030"],
			["peer-to-client", "8030"],
		])
		expect(wireEchoProblem(connection, CALLING_AE_TITLE, "BASELINE")).toBeUndefined()
	})

	it("resets the client side when the peer side fails and keeps the cause", async () => {
		const { relayClient, upstream, outcome } = relayed()
		upstream.destroy(Object.assign(new Error(RESET_MESSAGE), { code: RESET_CODE }))

		expect(await outcome).toMatchObject({ closedBy: "peer-error", error: RESET_CODE })
		expect(relayClient.destroyed).toBe(true)
	})
})

describe("C-ECHO confirmed from the wire integrace-dicom.md 9.1", () => {
	it("refuses a status on the wire other than success", async () => {
		const connection = await echoedConnection()
		const response = connection.messages[1]
		if (response?.command === undefined) {
			throw new Error("no response")
		}
		response.command.statusHex = "A700"

		expect(wireEchoProblem(connection, CALLING_AE_TITLE, "BASELINE")).toBe("C-ECHO-RSP status A700 on the wire")
	})

	it("integrace-dicom.md 6.3, 10 refuses a P-DATA-TF from the client over 16384 bytes", async () => {
		const connection = await echoedConnection()
		connection.clientToPeer.maxDataPduLength = PROFILE_MAX_PDU_LENGTH + 1

		expect(wireEchoProblem(connection, CALLING_AE_TITLE, "BASELINE")).toMatch(/16385 bytes over the peer's limit/)
	})

	it("refuses an association without release", async () => {
		const connection = await echoedConnection()
		connection.association.releaseResponded = false

		expect(wireEchoProblem(connection, CALLING_AE_TITLE, "BASELINE")).toMatch(/no release/)
	})

	it("refuses AE titles other than the ones the client asked for", async () => {
		expect(wireEchoProblem(await echoedConnection(), CALLING_AE_TITLE, "AMIS")).toMatch(/other AE titles/)
	})
})

describe("connectivity confirmed from the wire records", () => {
	let evidence: string | undefined

	afterEach(() => {
		if (evidence !== undefined) {
			rmSync(evidence, { recursive: true, force: true })
		}
	})

	const target = { peer: "hostile", aeTitle: "BASELINE", host: "127.0.0.1", port: 11_206 }
	const clientView = {
		id: "connectivity",
		source: "ADR-017",
		result: "pass" as const,
		peers: [
			{
				target: "BASELINE@hostile",
				result: "pass" as const,
				durationMs: 1,
				statusHex: "0000",
				acceptedTransferSyntax: IMPLICIT_VR_LITTLE_ENDIAN,
				peerMaxPduLength: PROFILE_MAX_PDU_LENGTH,
				peerImplementationClassUid: "2.25.1",
				wire: undefined,
			},
		],
	}

	function writeConnections(connections: readonly WireConnection[]): string {
		const directory = mkdtempSync(join(tmpdir(), "dicom-wire-"))
		evidence = directory
		mkdirSync(routeDirectory(directory, "hostile"), { recursive: true })
		writeFileSync(
			join(routeDirectory(directory, "hostile"), "pdus.jsonl"),
			connections.map((connection) => `${JSON.stringify(connection)}\n`).join(""),
		)
		return directory
	}

	it("passes when the client's view and the wire agree", async () => {
		const result = confirmFromWire(clientView, [target], writeConnections([await echoedConnection()]), CALLING_AE_TITLE)

		expect(result.result).toBe("pass")
		expect(result.peers[0]?.wire).toMatchObject({ connection: 1, statusHex: "0000" })
	})

	it("fails when the wire holds no connection for the peer", () => {
		const result = confirmFromWire(clientView, [target], writeConnections([]), CALLING_AE_TITLE)

		expect(result.peers).toMatchObject([{ result: "fail", reason: "0 connections recorded on the wire, expected 1" }])
	})
})
