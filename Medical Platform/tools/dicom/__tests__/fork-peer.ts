import { type AddressInfo, createServer, type Server, type Socket } from "node:net"
import { Client, constants, type Dataset, type requests } from "@veevoy/dcmjs-dimse"
import { hostileCases, performInOrder } from "../hostile/server"
import { HostileSession } from "../hostile/session"
import { CALLING_AE_TITLE, CLIENT_IMPLEMENTATION_CLASS_UID, LOOPBACK_HOST } from "../synthetic"
import { type ConnectionRecord, ConnectionRecorder } from "../wire/recorder"

// ADR-017, integrace-dicom.md 9.1, 11

export interface Peer {
	server: Server
	port: number
	record: Promise<ConnectionRecord>
	records: Promise<ConnectionRecord>[]
	resume(): void
	bytesWritten(): number
	bytesReceived(): number
	messagesFromClient(): number
	close(): void
}

const started: Peer[] = []

export function startPeer(): Promise<Peer> {
	const sockets: Socket[] = []
	const recorders: ConnectionRecorder[] = []
	const records: Promise<ConnectionRecord>[] = []
	let firstRecorded: (record: ConnectionRecord) => void = () => undefined
	const record = new Promise<ConnectionRecord>((resolve) => {
		firstRecorded = resolve
	})
	const server = createServer((socket) => {
		sockets.push(socket)
		const session = new HostileSession(hostileCases())
		const recorder = new ConnectionRecorder()
		recorders.push(recorder)
		const performAll = performInOrder(socket, (bytes) => recorder.receive("peer-to-client", bytes))
		const closed = new Promise<ConnectionRecord>((resolve) => socket.on("close", () => resolve(recorder.finish())))
		records.push(closed)
		if (records.length === 1) {
			void closed.then(firstRecorded)
		}
		socket.on("data", (chunk: Buffer) => {
			recorder.receive("client-to-peer", chunk)
			performAll(session.receive(chunk))
		})
		socket.on("error", () => undefined)
	})
	return new Promise((resolve) => {
		server.listen(0, LOOPBACK_HOST, () => {
			const peer: Peer = {
				server,
				port: (server.address() as AddressInfo).port,
				record,
				records,
				resume: () => {
					for (const socket of sockets) {
						socket.resume()
					}
				},
				bytesWritten: () => sockets.reduce((total, socket) => total + socket.bytesWritten, 0),
				bytesReceived: () => sockets.reduce((total, socket) => total + socket.bytesRead, 0),
				messagesFromClient: () =>
					recorders.reduce((total, recorder) => total + recorder.messagesFrom("client-to-peer").length, 0),
				close: () => {
					for (const socket of sockets) {
						socket.destroy()
					}
					server.close()
				},
			}
			started.push(peer)
			resolve(peer)
		})
	})
}

export function closePeers(): void {
	for (const peer of started.splice(0)) {
		peer.close()
	}
}

export async function closedPort(): Promise<number> {
	const server = createServer()
	const port = await new Promise<number>((resolve) =>
		server.listen(0, LOOPBACK_HOST, () => resolve((server.address() as AddressInfo).port)),
	)
	await new Promise<void>((resolve) => server.close(() => resolve()))
	return port
}

export type ClientOptions = Parameters<Client["send"]>[4]

export interface AssociationEnd {
	outcome: string
	timeout?: string
}

export interface Outcome {
	networkError: (Error & { timeout?: string }) | undefined
	statuses: number[]
	datasets: Dataset[]
	end: AssociationEnd | undefined
	events: string[][]
	associationsAccepted: number
}

export function run(
	port: number,
	calledAeTitle: string,
	requestOrRequests: requests.Request | readonly requests.Request[],
	options: Partial<ClientOptions> = {},
	prepare: (client: Client) => void = () => undefined,
): Promise<Outcome> {
	return new Promise((resolve) => {
		const outcome: Outcome = {
			networkError: undefined,
			statuses: [],
			datasets: [],
			end: undefined,
			events: [],
			associationsAccepted: 0,
		}
		const client = new Client()
		for (const request of Array.isArray(requestOrRequests) ? requestOrRequests : [requestOrRequests]) {
			const events: string[] = []
			outcome.events.push(events)
			request.on("response", (response: { getStatus(): number; getDataset(): Dataset | undefined }) => {
				outcome.statuses.push(response.getStatus())
				const dataset = response.getDataset()
				if (dataset !== undefined) {
					outcome.datasets.push(dataset)
				}
			})
			request.on("notSent", (reason: string) => events.push(reason))
			request.on("done", () => events.push("done"))
			client.addRequest(request)
		}
		prepare(client)
		client.on("associationAccepted", () => {
			outcome.associationsAccepted += 1
		})
		client.on("networkError", (error: Error) => {
			outcome.networkError = error
		})
		client.on("closed", (end: AssociationEnd) => {
			outcome.end = end
			resolve(outcome)
		})
		client.send(LOOPBACK_HOST, port, CALLING_AE_TITLE, calledAeTitle, {
			implementationClassUid: CLIENT_IMPLEMENTATION_CLASS_UID,
			...options,
		})
	})
}

export async function against(
	calledAeTitle: string,
	requestOrRequests: requests.Request | readonly requests.Request[],
	options: Partial<ClientOptions> = {},
	prepare?: (client: Client) => void,
): Promise<{ outcome: Outcome; record: ConnectionRecord }> {
	const peer = await startPeer()
	const outcome = await run(peer.port, calledAeTitle, requestOrRequests, options, prepare)
	peer.resume()
	return { outcome, record: await peer.record }
}

export const USER_ABORT = {
	by: "client-to-peer",
	source: constants.AbortSource.ServiceUser,
	reason: constants.AbortReason.NotSpecified,
}

export function providerAbort(reason: number) {
	return { by: "client-to-peer", source: constants.AbortSource.ServiceProvider, reason }
}
