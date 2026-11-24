import { createServer, type Server, type Socket } from "node:net"
import { setImmediate as yielded } from "node:timers/promises"
import { HOSTILE_CASES } from "./cases"
import { type HostileAction, type HostileCase, HostileSession } from "./session"

export function hostileCases(): ReadonlyMap<string, HostileCase> {
	return new Map(HOSTILE_CASES.map((hostileCase) => [hostileCase.calledAeTitle, hostileCase]))
}

function writable(socket: Socket): boolean {
	return !socket.destroyed && socket.writable
}

function drained(socket: Socket): Promise<void> {
	return new Promise((resolve) => {
		const done = () => {
			socket.off("drain", done)
			socket.off("close", done)
			resolve()
		}
		socket.once("drain", done)
		socket.once("close", done)
	})
}

type SentBytes = (bytes: Buffer) => void

async function flood(socket: Socket, next: () => Buffer, onSent: SentBytes): Promise<void> {
	while (writable(socket)) {
		const bytes = next()
		onSent(bytes)
		if (!socket.write(bytes)) {
			await drained(socket)
		}
		await yielded()
	}
}

export async function perform(
	socket: Socket,
	action: HostileAction,
	onSent: SentBytes = () => undefined,
): Promise<void> {
	if (!writable(socket)) {
		return
	}
	switch (action.kind) {
		case "send":
			onSent(action.bytes)
			socket.write(action.bytes)
			return
		case "close":
			socket.end()
			return
		case "reset":
			socket.resetAndDestroy()
			return
		case "pause":
			socket.pause()
			return
		case "silence":
			return
		case "flood":
			await flood(socket, action.next, onSent)
			return
		default:
			action satisfies never
	}
}

export function performInOrder(socket: Socket, onSent?: SentBytes): (actions: readonly HostileAction[]) => void {
	let pending = Promise.resolve()
	return (actions) => {
		pending = pending
			.then(async () => {
				for (const action of actions) {
					await perform(socket, action, onSent)
				}
			})
			.catch((error: unknown) => {
				console.log(JSON.stringify({ event: "action-failed", message: String(error) }))
				socket.destroy()
			})
	}
}

function serve(socket: Socket, cases: ReadonlyMap<string, HostileCase>): void {
	const session = new HostileSession(cases)
	const remote = socket.remoteAddress ?? null
	const performAll = performInOrder(socket)
	socket.on("data", (chunk: Buffer) => {
		performAll(session.receive(chunk))
	})
	socket.on("error", (error: NodeJS.ErrnoException) => {
		console.log(
			JSON.stringify({ event: "socket-error", called: session.calledAeTitle ?? null, code: error.code ?? null }),
		)
	})
	socket.on("close", () => {
		if (session.calledAeTitle === undefined && session.failure === undefined) {
			return
		}
		console.log(
			JSON.stringify({
				event: "connection-closed",
				called: session.calledAeTitle ?? null,
				calling: session.callingAeTitle ?? null,
				remote,
				failure: session.failure ?? null,
			}),
		)
	})
}

export function startHostileServer(port: number): Server {
	const cases = hostileCases()
	const server = createServer((socket) => serve(socket, cases))
	server.listen(port, () => {
		console.log(JSON.stringify({ event: "listening", port, cases: [...cases.keys()] }))
	})
	return server
}
