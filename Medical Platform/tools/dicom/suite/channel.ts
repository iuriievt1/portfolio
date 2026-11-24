import type { Duplex } from "node:stream"
import { type Pdu, PduReader } from "../pdu"

export class ChannelError extends Error {}

interface Waiting {
	resolve: (pdu: Pdu) => void
	reject: (error: Error) => void
	timer: NodeJS.Timeout
}

// integrace-dicom.md 6.3
export class PduChannel {
	private readonly reader: PduReader
	private readonly received: Pdu[] = []
	private waiting: Waiting | undefined
	private failure: Error | undefined

	constructor(
		private readonly stream: Duplex,
		maxPduLength: number,
	) {
		this.reader = new PduReader(maxPduLength)
		stream.on("data", (chunk: Buffer) => this.receive(chunk))
		stream.on("error", (error: Error) => this.fail(error))
		stream.on("close", () => this.fail(new ChannelError("connection closed")))
	}

	send(bytes: Buffer): void {
		this.stream.write(bytes)
	}

	close(): void {
		this.stream.end()
	}

	next(timeoutMs: number): Promise<Pdu> {
		const pdu = this.received.shift()
		if (pdu !== undefined) {
			return Promise.resolve(pdu)
		}
		if (this.failure !== undefined) {
			return Promise.reject(this.failure)
		}
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.waiting = undefined
				reject(new ChannelError(`no PDU within ${timeoutMs} ms`))
			}, timeoutMs)
			this.waiting = { resolve, reject, timer }
		})
	}

	private receive(chunk: Buffer): void {
		try {
			this.received.push(...this.reader.push(chunk))
		} catch (error) {
			this.fail(error instanceof Error ? error : new ChannelError(String(error)))
			this.stream.destroy()
			return
		}
		const waiting = this.waiting
		if (waiting === undefined) {
			return
		}
		const pdu = this.received.shift()
		if (pdu === undefined) {
			return
		}
		this.waiting = undefined
		clearTimeout(waiting.timer)
		waiting.resolve(pdu)
	}

	private fail(error: Error): void {
		this.failure ??= error
		const waiting = this.waiting
		if (waiting === undefined) {
			return
		}
		this.waiting = undefined
		clearTimeout(waiting.timer)
		waiting.reject(this.failure)
	}
}
