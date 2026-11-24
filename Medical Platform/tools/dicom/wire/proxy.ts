import { appendFileSync, mkdirSync, writeFileSync } from "node:fs"
import { connect, createServer, type Server, type Socket } from "node:net"
import { join } from "node:path"
import { Relay, type RelayOutcome } from "./relay"

// integrace-dicom.md 9.1, 11.1

export interface Route {
	name: string
	listenPort: number
	targetHost: string
	targetPort: number
}

const LISTEN_HOST = "127.0.0.1"
const CONNECTION_NUMBER_DIGITS = 4

export function routeDirectory(evidence: string, name: string): string {
	return join(evidence, `proxy-${name}`)
}

export class WireProxy {
	private readonly servers: Server[] = []
	private readonly relays = new Set<Relay>()
	private drained: (() => void) | undefined

	constructor(
		private readonly routes: readonly Route[],
		private readonly evidence: string,
	) {}

	async start(): Promise<void> {
		for (const route of this.routes) {
			const directory = routeDirectory(this.evidence, route.name)
			mkdirSync(directory, { recursive: true })
			let connections = 0
			const server = createServer({ allowHalfOpen: true }, (client) => {
				connections += 1
				this.accept(route, directory, connections, client)
			})
			this.servers.push(server)
			await new Promise<void>((resolve, reject) => {
				server.once("error", reject)
				server.listen(route.listenPort, LISTEN_HOST, () => {
					server.off("error", reject)
					resolve()
				})
			})
		}
	}

	async stop(): Promise<void> {
		const closed = this.servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve())))
		const written = new Promise<void>((resolve) => {
			this.drained = resolve
		})
		if (this.relays.size === 0) {
			this.drained?.()
		}
		for (const relay of this.relays) {
			relay.shutdown()
		}
		await Promise.all([...closed, written])
	}

	private accept(route: Route, directory: string, number: number, client: Socket): void {
		const startedAt = new Date()
		const upstream = connect({ host: route.targetHost, port: route.targetPort, allowHalfOpen: true })
		const relay = new Relay(client, upstream, (outcome) => {
			this.write(route, directory, number, startedAt, outcome)
			this.relays.delete(relay)
			if (this.relays.size === 0) {
				this.drained?.()
			}
		})
		this.relays.add(relay)
	}

	private write(route: Route, directory: string, number: number, startedAt: Date, outcome: RelayOutcome): void {
		const pdusFile = `pdus-${String(number).padStart(CONNECTION_NUMBER_DIGITS, "0")}.json`
		const { pdus, ...record } = outcome.record
		writeFileSync(
			join(directory, pdusFile),
			`${JSON.stringify({ connection: number, peer: route.name, pdus }, null, "\t")}\n`,
		)
		const summary = {
			connection: number,
			peer: route.name,
			target: `${route.targetHost}:${route.targetPort}`,
			startedAt: startedAt.toISOString(),
			durationMs: Date.now() - startedAt.getTime(),
			closedBy: outcome.closedBy,
			error: outcome.error,
			pdusFile,
			...record,
		}
		appendFileSync(join(directory, "pdus.jsonl"), `${JSON.stringify(summary)}\n`)
	}
}
