import { Client, constants, log, requests } from "@veevoy/dcmjs-dimse"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { CALLING_AE_TITLE, CLIENT_IMPLEMENTATION_CLASS_UID, LOOPBACK_HOST, SYNTHETIC_PATIENT_ID } from "../synthetic"
import { closePeers, type Peer, startPeer } from "./fork-peer"
import { wait } from "./support"

// integrace-dicom.md 6.3, ADR-003 ř. 29

const POLL_MS = 100
const HELD_MS = 400
const DEADLINE_MS = 15_000
const TEST_TIMEOUT_MS = 40_000
const { AbortReason, AbortSource } = constants

async function steadyBytesWritten(peer: Peer): Promise<number> {
	const deadline = Date.now() + DEADLINE_MS
	let previous = peer.bytesWritten()
	while (Date.now() < deadline) {
		await wait(POLL_MS)
		const current = peer.bytesWritten()
		if (current === previous) {
			return current
		}
		previous = current
	}
	throw new Error("the peer kept writing while the client did not read")
}

async function bytesWrittenPast(peer: Peer, written: number): Promise<number> {
	const deadline = Date.now() + DEADLINE_MS
	while (Date.now() < deadline) {
		await wait(POLL_MS)
		if (peer.bytesWritten() > written) {
			return peer.bytesWritten()
		}
	}
	return peer.bytesWritten()
}

describe("@veevoy/dcmjs-dimse holds a flooding peer by the TCP window while it does not read", () => {
	beforeAll(() => {
		log.setLevel("error")
	})

	afterEach(closePeers)

	it(
		"integrace-dicom.md 6.3 lets FIND-FLOOD write nothing more while paused and more once resumed",
		async () => {
			const peer = await startPeer()
			const client = new Client()
			const request = requests.CFindRequest.createStudyFindRequest({ PatientID: SYNTHETIC_PATIENT_ID })
			const paused = new Promise<void>((resolve) => {
				request.once("response", () => {
					client.pauseReceiving()
					resolve()
				})
			})
			const closed = new Promise<void>((resolve) => client.on("closed", () => resolve()))
			client.on("networkError", () => undefined)
			client.addRequest(request)
			client.send(LOOPBACK_HOST, peer.port, CALLING_AE_TITLE, "FIND-FLOOD", {
				implementationClassUid: CLIENT_IMPLEMENTATION_CLASS_UID,
			})

			await paused
			const heldAt = await steadyBytesWritten(peer)
			await wait(HELD_MS)
			const stillHeldAt = peer.bytesWritten()
			client.resumeReceiving()
			const resumedAt = await bytesWrittenPast(peer, stillHeldAt)
			client.abort(AbortSource.ServiceUser, AbortReason.NotSpecified)
			await closed

			expect(stillHeldAt).toBe(heldAt)
			expect(resumedAt).toBeGreaterThan(stillHeldAt)
		},
		TEST_TIMEOUT_MS,
	)
})
