import { type Client, Dataset, type requests, type responses } from "@veevoy/dcmjs-dimse"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { type Session, type SessionEnd, unopenedEnd } from "../association-session"
import { ASSOCIATION_OUTCOME, INFORMATION_MODEL } from "../contract"
import { ForkFindStream } from "../find-stream"

// integrace-dicom.md 6.1, 6.3, 6.4

const TARGET = { host: "127.0.0.1", port: 104, callingAeTitle: "VULNA", calledAeTitle: "BASELINE" }
const IDENTITY = { implementationClassUid: "2.25.1" }
const QUERY = { informationModel: INFORMATION_MODEL.STUDY_ROOT, identifier: { QueryRetrieveLevel: "STUDY" } }
const PENDING = 0xff_00
const SUCCESS = 0x00_00
const HIGH_WATER_MARK = 2
const STALL_MS = 100
const GRACE_MS = 100
const COMMAND_BYTES = 100

function response(status: number): responses.Response {
	return {
		getStatus: () => status,
		getErrorComment: () => undefined,
		getDataset: () => (status === PENDING ? new Dataset({ PatientID: "1000101" }) : undefined),
	} as unknown as responses.Response
}

function released(): SessionEnd {
	const end = unopenedEnd(0)
	return { ...end, association: { ...end.association, outcome: ASSOCIATION_OUTCOME.RELEASED } }
}

function fakeSession() {
	let request: requests.Request | undefined
	let end: (ended: SessionEnd) => void = () => undefined
	const client = {
		pauseReceiving: vi.fn(),
		resumeReceiving: vi.fn(),
		cancel: vi.fn(),
		addRequest: (added: requests.Request) => {
			request = added
			vi.spyOn(added, "getCommandBytesSent").mockReturnValue(COMMAND_BYTES)
		},
	}
	const session: Session = {
		client: client as unknown as Client,
		markResponded: vi.fn(),
		abort: vi.fn(),
		isAssociated: () => true,
		ended: new Promise((resolve) => {
			end = resolve
		}),
	}
	return {
		client,
		session,
		open: (_target: unknown, _identity: unknown, prepare: (client: Client) => void) => {
			prepare(client as unknown as Client)
			return session
		},
		respond: (status: number) => request?.raiseResponseEvent(response(status)),
		end: () => end(released()),
	}
}

describe("the find stream of integrace-dicom.md 6.1", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
		vi.restoreAllMocks()
	})

	it("6.3 leaves no grace timer when the final response comes while reading resumes for the cancel", async () => {
		const fake = fakeSession()
		fake.client.resumeReceiving.mockImplementation(() => fake.respond(SUCCESS))
		const stream = new ForkFindStream(
			TARGET,
			{ ...QUERY, highWaterMark: HIGH_WATER_MARK, cancelGraceMs: GRACE_MS },
			IDENTITY,
			undefined,
			fake.open,
		)
		fake.respond(PENDING)
		fake.respond(PENDING)
		stream.cancel()
		await vi.advanceTimersByTimeAsync(GRACE_MS * 2)

		expect(fake.client.pauseReceiving).toHaveBeenCalledTimes(1)
		expect(fake.client.cancel).toHaveBeenCalledTimes(1)
		expect(fake.session.abort).not.toHaveBeenCalled()
		expect(vi.getTimerCount()).toBe(0)
	})

	it("6.4 runs no consumer stall timer once the final response came", async () => {
		const fake = fakeSession()
		const stream = new ForkFindStream(TARGET, { ...QUERY, consumerStallMs: STALL_MS }, IDENTITY, undefined, fake.open)
		const iterator = stream[Symbol.asyncIterator]()
		fake.respond(PENDING)
		fake.respond(PENDING)
		fake.respond(SUCCESS)
		await iterator.next()

		expect(vi.getTimerCount()).toBe(0)
		fake.end()
		expect((await stream.result).cancelRequested).toBe(false)
	})

	it("6.1 answers every next() asked before the matches came, in order", async () => {
		const fake = fakeSession()
		const stream = new ForkFindStream(TARGET, QUERY, IDENTITY, undefined, fake.open)
		const iterator = stream[Symbol.asyncIterator]()
		const first = iterator.next()
		const second = iterator.next()
		fake.respond(PENDING)
		fake.respond(PENDING)

		expect((await first).done).toBe(false)
		expect((await second).done).toBe(false)
	})

	it("6.1 ends a next() that waits when the consumer returns", async () => {
		const fake = fakeSession()
		const stream = new ForkFindStream(TARGET, QUERY, IDENTITY, undefined, fake.open)
		const iterator = stream[Symbol.asyncIterator]()
		const waiting = iterator.next()
		await iterator.return?.()

		expect(await waiting).toEqual({ value: undefined, done: true })
		expect(await iterator.next()).toEqual({ value: undefined, done: true })
	})
})
