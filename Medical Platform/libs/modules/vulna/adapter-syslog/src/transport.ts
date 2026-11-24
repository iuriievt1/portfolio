import { createSocket } from "node:dgram"
import { lookup } from "node:dns/promises"
import { connect as connectTcp, isIP, type Socket } from "node:net"
import { connect as connectTls } from "node:tls"
import { SYSLOG_TRANSPORT, type SyslogTransport } from "@ansora/core-server/ports"

const SEND_TIMEOUT_MILLISECONDS = 30_000
const UDP_PAYLOAD_LIMIT = 65_507
const IPV6 = 6
const MINIMUM_TLS_VERSION = "TLSv1.2"

export interface TlsMaterial {
	ca?: Buffer
	cert?: Buffer
	key?: Buffer
}

export interface TransportSettings {
	host: string
	port: number
	transport: SyslogTransport
	tls: TlsMaterial
}

export class SyslogTimeoutError extends Error {
	constructor() {
		super("the log management system did not take the messages in time")
		this.name = "SyslogTimeoutError"
	}
}

export class SyslogConnectionClosedError extends Error {
	constructor() {
		super("the log management system closed the connection before taking the messages")
		this.name = "SyslogConnectionClosedError"
	}
}

export class SyslogMessageTooLargeError extends Error {
	constructor(readonly size: number) {
		super(`a message of ${size} bytes does not fit into a UDP datagram`)
		this.name = "SyslogMessageTooLargeError"
	}
}

function streamSocket(settings: TransportSettings): Socket {
	if (settings.transport === SYSLOG_TRANSPORT.TLS) {
		return connectTls({
			host: settings.host,
			port: settings.port,
			servername: isIP(settings.host) === 0 ? settings.host : undefined,
			minVersion: MINIMUM_TLS_VERSION,
			...settings.tls,
		})
	}
	return connectTcp({ host: settings.host, port: settings.port })
}

// RFC 5425, RFC 6587
export function sendOverStream(payload: Buffer, settings: TransportSettings): Promise<void> {
	return new Promise((resolve, reject) => {
		const socket = streamSocket(settings)
		let settled = false
		const settle = (failure?: Error) => {
			if (settled) {
				return
			}
			settled = true
			if (failure === undefined) {
				socket.unref()
				resolve()
				return
			}
			socket.destroy()
			reject(failure)
		}
		socket.setTimeout(SEND_TIMEOUT_MILLISECONDS, () => {
			settle(new SyslogTimeoutError())
			socket.destroy()
		})
		socket.on("error", settle)
		socket.on("close", () => settle(new SyslogConnectionClosedError()))
		socket.end(payload, () => settle())
	})
}

// RFC 5426
export async function sendOverUdp(messages: readonly Buffer[], settings: TransportSettings): Promise<void> {
	const tooLarge = messages.find((message) => message.byteLength > UDP_PAYLOAD_LIMIT)
	if (tooLarge !== undefined) {
		throw new SyslogMessageTooLargeError(tooLarge.byteLength)
	}
	const { address, family } = await lookup(settings.host)
	const socket = createSocket(family === IPV6 ? "udp6" : "udp4")
	try {
		for (const message of messages) {
			await new Promise<void>((resolve, reject) =>
				socket.send(message, settings.port, address, (error) => (error === null ? resolve() : reject(error))),
			)
		}
	} finally {
		socket.close()
	}
}
