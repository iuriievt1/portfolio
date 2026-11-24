import type { Duplex } from "node:stream"
import { type ConnectionRecord, ConnectionRecorder } from "./recorder"

// integrace-dicom.md 9.1, 11.1

export type ClosedBy = "client" | "peer" | "client-error" | "peer-error" | "proxy-shutdown"

export interface RelayOutcome {
	closedBy: ClosedBy | undefined
	error: string | undefined
	record: ConnectionRecord
}

type Side = "client" | "peer"

function reset(stream: Duplex): void {
	const socket = stream as Duplex & { resetAndDestroy?: () => void }
	if (typeof socket.resetAndDestroy === "function") {
		socket.resetAndDestroy()
		return
	}
	stream.destroy()
}

export class Relay {
	private readonly recorder = new ConnectionRecorder()
	private closedBy: ClosedBy | undefined
	private error: string | undefined
	private openSides = 2
	private finished = false

	constructor(
		private readonly client: Duplex,
		private readonly upstream: Duplex,
		private readonly onFinished: (outcome: RelayOutcome) => void,
	) {
		client.on("data", (chunk: Buffer) => this.recorder.receive("client-to-peer", chunk))
		upstream.on("data", (chunk: Buffer) => this.recorder.receive("peer-to-client", chunk))
		client.pipe(upstream)
		upstream.pipe(client)
		client.on("end", () => this.mark("client"))
		upstream.on("end", () => this.mark("peer"))
		client.on("error", (error: NodeJS.ErrnoException) => this.failed("client", upstream, error))
		upstream.on("error", (error: NodeJS.ErrnoException) => this.failed("peer", client, error))
		client.on("close", () => this.sideClosed())
		upstream.on("close", () => this.sideClosed())
	}

	shutdown(): void {
		this.mark("proxy-shutdown")
		this.client.destroy()
		this.upstream.destroy()
	}

	private mark(closedBy: ClosedBy): void {
		this.closedBy ??= closedBy
	}

	private failed(side: Side, other: Duplex, error: NodeJS.ErrnoException): void {
		this.mark(side === "client" ? "client-error" : "peer-error")
		this.error ??= error.code ?? error.message
		reset(other)
	}

	private sideClosed(): void {
		this.openSides -= 1
		if (this.openSides > 0 || this.finished) {
			return
		}
		this.finished = true
		this.onFinished({ closedBy: this.closedBy, error: this.error, record: this.recorder.finish() })
	}
}
