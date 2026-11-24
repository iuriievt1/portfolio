import { createSocket } from "node:dgram"
import { type AddressInfo, createServer, type Server } from "node:net"
import type { AuditRecord } from "@ansora/core-server/ports"
import { afterEach, describe, expect, it } from "vitest"
import { SyslogAuditSink, SyslogMessageTooLargeError, type SyslogSettings } from "../index"
import { syslogMessage } from "../message"

const LOCALHOST = "127.0.0.1"

function record(sequence: number, details: AuditRecord["details"]): AuditRecord {
	return {
		id: `00000000-0000-4000-8000-00000000000${sequence}`,
		sequence,
		occurredAt: "2026-10-06T08:05:09.123Z",
		eventType: "configuration-changed",
		actorKind: "user",
		actorUserId: "11111111-1111-4111-8111-111111111111",
		actorDeviceId: null,
		systemJob: null,
		sessionId: null,
		objectId: null,
		sourceAddress: null,
		outcome: "success",
		details,
		previousHash: "",
		hash: "c".repeat(64),
	}
}

function settings(port: number, overrides: Partial<SyslogSettings> = {}): SyslogSettings {
	return {
		host: LOCALHOST,
		port,
		transport: "tcp",
		framing: "octet_counting",
		format: "rfc5424",
		enterpriseNumber: 32_473,
		hostname: "worker",
		tls: {},
		...overrides,
	}
}

// RFC 6587 3.4.1
function octetCountedMessages(stream: Buffer): string[] {
	const messages: string[] = []
	let rest = stream
	while (rest.byteLength > 0) {
		const space = rest.indexOf(0x20)
		const length = Number(rest.subarray(0, space).toString("ascii"))
		messages.push(rest.subarray(space + 1, space + 1 + length).toString("utf8"))
		rest = rest.subarray(space + 1 + length)
	}
	return messages
}

let server: Server | undefined

afterEach(() => {
	server?.close()
	server = undefined
})

function collector(): Promise<{ port: number; received: Promise<Buffer> }> {
	return new Promise((resolveListening) => {
		let resolveReceived: (stream: Buffer) => void = () => undefined
		const received = new Promise<Buffer>((resolve) => {
			resolveReceived = resolve
		})
		const listening = createServer((socket) => {
			const chunks: Buffer[] = []
			socket.on("data", (chunk) => chunks.push(chunk))
			socket.on("end", () => {
				socket.end()
				resolveReceived(Buffer.concat(chunks))
			})
		})
		server = listening
		listening.listen(0, LOCALHOST, () => {
			resolveListening({ port: (listening.address() as AddressInfo).port, received })
		})
	})
}

describe("Syslog audit sink", () => {
	it("CAP-025-S09 delivers a multi-line record over plain TCP as exactly one whole message", async () => {
		const { port, received } = await collector()
		const records = [record(1, { reason: "first line\nsecond line" }), record(2, { reason: "single" })]
		const target = settings(port)

		await new SyslogAuditSink(target).export(records)

		const messages = octetCountedMessages(await received)
		expect(messages).toHaveLength(records.length)
		expect(messages).toEqual(records.map((entry) => syslogMessage(entry, target).toString("utf8")))
	})

	it("CAP-025-S03 fails when the log management system does not accept the connection", async () => {
		const { port } = await collector()
		server?.close()

		await expect(new SyslogAuditSink(settings(port)).export([record(1, {})])).rejects.toMatchObject({
			code: "ECONNREFUSED",
		})
	})

	it("sends one datagram per record over UDP", async () => {
		const receiver = createSocket("udp4")
		const datagrams: string[] = []
		const port = await new Promise<number>((resolve) =>
			receiver.bind(0, LOCALHOST, () => resolve(receiver.address().port)),
		)
		const both = new Promise<void>((resolve) => {
			receiver.on("message", (message) => {
				datagrams.push(message.toString("utf8"))
				if (datagrams.length === 2) {
					resolve()
				}
			})
		})
		const target = settings(port, { transport: "udp" })

		await new SyslogAuditSink(target).export([record(1, {}), record(2, {})])
		await both
		receiver.close()

		expect(datagrams).toEqual([
			syslogMessage(record(1, {}), target).toString("utf8"),
			syslogMessage(record(2, {}), target).toString("utf8"),
		])
	})

	it("refuses a record that does not fit into one UDP datagram", async () => {
		const huge = record(1, { reason: "x".repeat(70_000) })

		await expect(new SyslogAuditSink(settings(9, { transport: "udp" })).export([huge])).rejects.toBeInstanceOf(
			SyslogMessageTooLargeError,
		)
	})
})
