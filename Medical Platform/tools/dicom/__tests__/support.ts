import { createHash } from "node:crypto"
import { type Duplex, duplexPair } from "node:stream"
import { hostileCases } from "../hostile/server"
import { HostileSession } from "../hostile/session"

const POLL_MS = 10
const UNTIL_DEADLINE_MS = 10_000
export const RESET_CODE = "ECONNRESET"
export const RESET_MESSAGE = "read ECONNRESET"

export function sha256(bytes: Buffer): string {
	return createHash("sha256").update(bytes).digest("hex")
}

export function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function until(condition: () => boolean, what: string, deadlineMs = UNTIL_DEADLINE_MS): Promise<void> {
	const deadline = Date.now() + deadlineMs
	while (!condition()) {
		if (Date.now() > deadline) {
			throw new Error(`waited ${deadlineMs} ms for ${what}`)
		}
		await wait(POLL_MS)
	}
}

export async function collect<T>(stream: AsyncIterable<T>, pauseMs = 0): Promise<T[]> {
	const items: T[] = []
	for await (const item of stream) {
		items.push(item)
		if (pauseMs > 0) {
			await wait(pauseMs)
		}
	}
	return items
}

// integrace-dicom.md 11
export function serveHostile(server: Duplex, client: Duplex): void {
	const session = new HostileSession(hostileCases())
	server.on("data", (chunk: Buffer) => {
		for (const action of session.receive(chunk)) {
			switch (action.kind) {
				case "send":
					server.write(action.bytes)
					break
				case "close":
					server.end()
					break
				case "reset":
					client.destroy(Object.assign(new Error(RESET_MESSAGE), { code: RESET_CODE }))
					break
				case "pause":
					server.pause()
					break
				case "silence":
					break
				case "flood":
					while (server.write(action.next())) {}
					break
				default:
					action satisfies never
			}
		}
	})
}

export function hostileDuplex(): Duplex {
	const [client, server] = duplexPair()
	serveHostile(server, client)
	return client
}
