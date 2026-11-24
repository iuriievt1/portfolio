import { UNKNOWN_OUTCOMES_BEFORE_FAILURE } from "@ansora/core-server"
import {
	CLINICAL_RECORD_FAILURE,
	type ClinicalActor,
	ClinicalRecordStoreError,
	type ClinicalRecordStorePort,
} from "@ansora/vulna-domain"
import { describe, expect, it } from "vitest"
import { fakeDatabase } from "../../encounter/__tests__/encounter-fixtures"
import type { ActorTaskRepository } from "../repositories/actor-task.repository"
import type { ClinicalActorRepository } from "../repositories/clinical-actor.repository"
import type { FhirResourceLinkRepository } from "../repositories/fhir-resource-link.repository"
import { ActorWriterService } from "../services/actor-writer.service"
import type { ClinicalRecordStoreService } from "../services/clinical-record-store.service"
import type { ClaimedWriteTask, ResourceLink } from "../types/clinical-record.types"

const USER_ID = "22222222-2222-4222-8222-222222222222"
const TASK: ClaimedWriteTask = {
	id: "33333333-3333-4333-8333-333333333333",
	objectId: USER_ID,
	attempts: 1,
	unknownOutcomes: 0,
	requestedAt: "1791363600123456",
}
const MEMBERSHIP = "55555555-5555-4555-8555-555555555555"
const ACTOR: ClinicalActor = {
	userId: USER_ID,
	displayName: "Nováková Jana",
	department: { id: "44444444-4444-4444-8444-444444444444", code: "KRO" },
	roles: ["clinician"],
}

interface Settled {
	completed: string[]
	failed: string[]
	retried: { id: string; delay: number }[]
	unknown: string[]
}

function harness(options: {
	store: Partial<ClinicalRecordStorePort> | undefined
	task?: ClaimedWriteTask | undefined
	actor?: ClinicalActor | undefined
}) {
	const settled: Settled = { completed: [], failed: [], retried: [], unknown: [] }
	let claims = 0
	const queue = {
		claim: async () => {
			claims += 1
			return "task" in options ? options.task : TASK
		},
		retryLater: async (taskId: string, delay: number) => {
			settled.retried.push({ id: taskId, delay })
		},
		retryAfterUnknownOutcome: async (taskId: string) => {
			settled.unknown.push(taskId)
		},
	}
	const tasks = {
		queue,
		complete: async (task: ClaimedWriteTask) => {
			settled.completed.push(task.id)
		},
		fail: async (task: ClaimedWriteTask) => {
			settled.failed.push(task.id)
		},
	} as unknown as ActorTaskRepository
	const actors = {
		actorOf: async () => ("actor" in options ? options.actor : ACTOR),
	} as unknown as ClinicalActorRepository
	const stores = { current: async () => options.store } as unknown as ClinicalRecordStoreService
	const linked: ResourceLink[] = []
	const links = {
		upsert: async (_tx: never, rows: readonly ResourceLink[]) => {
			linked.push(...rows)
		},
	} as unknown as FhirResourceLinkRepository
	return {
		service: new ActorWriterService(tasks, actors, fakeDatabase(), links, stores),
		settled,
		linked,
		claims: () => claims,
	}
}

function storeThat(write: (actor: ClinicalActor) => Promise<unknown>): Partial<ClinicalRecordStorePort> {
	return {
		recordActor: async (actor: ClinicalActor) => {
			await write(actor)
			return MEMBERSHIP
		},
	}
}

describe("ActorWriterService", () => {
	it("CAP-021-S33 writes the actor and closes the task", async () => {
		const written: ClinicalActor[] = []
		const { service, settled } = harness({ store: storeThat(async (actor) => void written.push(actor)) })

		expect(await service.writeNext()).toBe(true)

		expect(written).toEqual([ACTOR])
		expect(settled.completed).toEqual([TASK.id])
	})

	it("ADR-053 bod 6 keeps the membership of the user for reading on its behalf", async () => {
		const { service, linked } = harness({ store: storeThat(async () => undefined) })

		await service.writeNext()

		expect(linked).toEqual([
			{ resourceType: "ProjectMembership", localKind: "actor", localId: USER_ID, resourceId: MEMBERSHIP },
		])
	})

	it("CAP-001-S34 lets the task wait and retry while the store is unavailable", async () => {
		const { service, settled } = harness({
			store: storeThat(async () => {
				throw new ClinicalRecordStoreError(CLINICAL_RECORD_FAILURE.UNAVAILABLE, "connection refused")
			}),
		})

		await service.writeNext()

		expect(settled.failed).toEqual([])
		expect(settled.retried).toEqual([{ id: TASK.id, delay: expect.any(Number) }])
		expect(settled.retried[0]?.delay).toBeGreaterThan(0)
	})

	it("ADR-050 bod 10 stops retrying a write the store rejected", async () => {
		const { service, settled } = harness({
			store: storeThat(async () => {
				throw new ClinicalRecordStoreError(CLINICAL_RECORD_FAILURE.REJECTED, "400 invalid")
			}),
		})

		await service.writeNext()

		expect(settled.failed).toEqual([TASK.id])
		expect(settled.retried).toEqual([])
	})

	it("CAP-021-R27 retries a write whose outcome stayed unknown and counts it", async () => {
		const { service, settled } = harness({
			store: storeThat(async () => {
				throw new ClinicalRecordStoreError(CLINICAL_RECORD_FAILURE.UNKNOWN, "timeout")
			}),
		})

		await service.writeNext()

		expect(settled.unknown).toEqual([TASK.id])
		expect(settled.failed).toEqual([])
	})

	it("CAP-021-S25 fails the write whose outcome stayed unknown ten times in a row", async () => {
		const { service, settled } = harness({
			store: storeThat(async () => {
				throw new ClinicalRecordStoreError(CLINICAL_RECORD_FAILURE.UNKNOWN, "timeout")
			}),
			task: { ...TASK, unknownOutcomes: UNKNOWN_OUTCOMES_BEFORE_FAILURE - 1 },
		})

		await service.writeNext()

		expect(settled.failed).toEqual([TASK.id])
		expect(settled.unknown).toEqual([])
	})

	it("treats an unexpected error as a transient one", async () => {
		const { service, settled } = harness({
			store: storeThat(async () => {
				throw new TypeError("fetch failed")
			}),
		})

		await service.writeNext()

		expect(settled.retried).toHaveLength(1)
	})

	it("claims nothing while the store is not configured", async () => {
		const { service, claims } = harness({ store: undefined })

		expect(await service.writeNext()).toBe(false)
		expect(claims()).toBe(0)
	})

	it("reports an empty queue so the cycle waits", async () => {
		const { service } = harness({ store: storeThat(async () => undefined), task: undefined })

		expect(await service.writeNext()).toBe(false)
	})

	it("fails a task whose user no longer exists", async () => {
		const { service, settled } = harness({ store: storeThat(async () => undefined), actor: undefined })

		await service.writeNext()

		expect(settled.failed).toEqual([TASK.id])
	})
})
