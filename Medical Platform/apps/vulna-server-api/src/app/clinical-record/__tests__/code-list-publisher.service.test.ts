import { CLINICAL_RECORD_FAILURE, type ClinicalCodeListSet, ClinicalRecordStoreError } from "@ansora/vulna-domain"
import { describe, expect, it } from "vitest"
import type { DatabaseService } from "../../../libs/database/database.service"
import type { CodeListRepository } from "../../code-list/repositories/code-list.repository"
import type { CodeListSetRepository } from "../../code-list/repositories/code-list-set.repository"
import type { CodeListSetRow } from "../../code-list/types/code-list.types"
import type { ConfigurationService } from "../../configuration/services/configuration.service"
import type { CodeListSetTaskRepository } from "../repositories/code-list-set-task.repository"
import type { ClinicalRecordStoreService } from "../services/clinical-record-store.service"
import { CodeListPublisherService } from "../services/code-list-publisher.service"
import type { ClaimedWriteTask } from "../types/clinical-record.types"

const SET_ID = "5e000000-0000-4000-8000-000000000005"
const NEWER_SET_ID = "5e000000-0000-4000-8000-000000000006"
const TASK: ClaimedWriteTask = { id: "t1", objectId: SET_ID, attempts: 1, unknownOutcomes: 0, requestedAt: "1" }
const OWN_SET: CodeListSetRow = { id: SET_ID, version: 5, body_diagram_version: "1" }
const NEWER_SET: CodeListSetRow = { id: NEWER_SET_ID, version: 6, body_diagram_version: "1" }

interface Setup {
	latest: CodeListSetRow[]
	failure: Error | undefined
}

function harness(setup: Partial<Setup> = {}) {
	const state: Setup = { latest: [OWN_SET], failure: undefined, ...setup }
	const published: ClinicalCodeListSet[] = []
	const settled: string[] = []
	const enqueued: string[] = []
	const isolations: (string | undefined)[] = []
	const tasks = {
		queue: {
			claim: async () => TASK,
			retryLater: async () => {
				settled.push("retry")
			},
		},
		complete: async () => {
			settled.push("complete")
		},
		fail: async () => {
			settled.push("fail")
		},
		enqueue: async (_tx: never, objectId: string) => {
			enqueued.push(objectId)
		},
	} as unknown as CodeListSetTaskRepository
	const codeLists = {
		lists: async () => [{ code: "wound-type", name: "Typ rány", sequence: 1, item_count: 1 }],
		items: async () => [
			{ id: "i1", codeListCode: "wound-type", code: "burn", sequence: 1, isActive: true, names: { cs: "Popálenina" } },
		],
	} as unknown as CodeListRepository
	let reads = 0
	const sets = {
		latest: async () => state.latest[Math.min(reads++, state.latest.length - 1)],
	} as unknown as CodeListSetRepository
	const database = {
		sql: {
			begin: async (...args: unknown[]) => {
				const work = args.at(-1) as (tx: unknown) => Promise<unknown>
				isolations.push(args.length > 1 ? (args[0] as string) : undefined)
				return await work({})
			},
		},
	} as unknown as DatabaseService
	const store = {
		publishCodeLists: async (set: ClinicalCodeListSet) => {
			if (state.failure !== undefined) {
				throw state.failure
			}
			published.push(set)
		},
	}
	const stores = { current: async () => store } as unknown as ClinicalRecordStoreService
	const service = new CodeListPublisherService(
		database,
		tasks,
		codeLists,
		sets,
		{ instanceDefaultLanguage: async () => "cs" } as unknown as ConfigurationService,
		stores,
	)
	return { service, published, settled, enqueued, isolations }
}

describe("code list set published to the clinical record CAP-017-R20", () => {
	it("CAP-017-S15 writes every code list with the set version and its names", async () => {
		const run = harness()

		await run.service.writeNext()

		expect(run.published).toEqual([
			{
				version: "5",
				defaultLanguage: "cs",
				codeLists: [
					{
						code: "wound-type",
						title: "Typ rány",
						concepts: [{ code: "burn", isActive: true, names: { cs: "Popálenina" } }],
					},
				],
			},
		])
		expect(run.settled).toEqual(["complete"])
		expect(run.enqueued).toEqual([])
	})

	it("reads the set and its items in one snapshot", async () => {
		const run = harness()

		await run.service.writeNext()

		expect(run.isolations).toEqual(["isolation level repeatable read read only"])
	})

	it("publishes the newest set for a task of an older one, so an old version never overwrites newer content", async () => {
		const run = harness({ latest: [NEWER_SET] })

		await run.service.writeNext()

		expect(run.published.map((set) => set.version)).toEqual(["6"])
		expect(run.settled).toEqual(["complete"])
		expect(run.enqueued).toEqual([])
	})

	it("ADR-050 bod 7 queues the newest set again when it appeared while an older one was being written", async () => {
		const run = harness({ latest: [OWN_SET, NEWER_SET] })

		await run.service.writeNext()

		expect(run.published.map((set) => set.version)).toEqual(["5"])
		expect(run.enqueued).toEqual([NEWER_SET_ID])
	})

	it("ADR-050 bod 10 gives up on a set the store rejects and retries one it cannot reach", async () => {
		const rejected = harness({ failure: new ClinicalRecordStoreError(CLINICAL_RECORD_FAILURE.REJECTED, "invalid") })
		const unreachable = harness({ failure: new ClinicalRecordStoreError(CLINICAL_RECORD_FAILURE.UNAVAILABLE, "down") })

		await rejected.service.writeNext()
		await unreachable.service.writeNext()

		expect(rejected.settled).toEqual(["fail"])
		expect(unreachable.settled).toEqual(["retry"])
		expect(unreachable.enqueued).toEqual([])
	})

	it("fails a task when the instance has no code list set", async () => {
		const run = harness({ latest: [] })

		await run.service.writeNext()

		expect(run.published).toEqual([])
		expect(run.settled).toEqual(["fail"])
	})
})
