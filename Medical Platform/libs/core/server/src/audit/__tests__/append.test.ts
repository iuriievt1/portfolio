import { describe, expect, it } from "vitest"
import { auditRecordOf } from "../append"
import {
	AUDIT_ACTOR_KIND,
	AUDIT_EVENT_TYPE,
	AUDIT_OUTCOME,
	auditRecordHash,
	FIRST_AUDIT_SEQUENCE,
	NO_PREVIOUS_HASH,
} from "../record"

const NOW = new Date("2026-10-08T08:00:00.000Z")
const EVENT = {
	eventType: AUDIT_EVENT_TYPE.ENCOUNTER_COMPLETED,
	actorKind: AUDIT_ACTOR_KIND.USER,
	actorUserId: "11111111-1111-4111-8111-111111111111",
	outcome: AUDIT_OUTCOME.COMPLETED,
	details: { encounter_id: "22222222-2222-4222-8222-222222222222" },
}

describe("next record of the audit chain CAP-025-R04, CAP-025-R21", () => {
	it("starts the chain without a previous hash", () => {
		const record = auditRecordOf(undefined, EVENT, NOW)

		expect(record).toMatchObject({
			sequence: FIRST_AUDIT_SEQUENCE,
			previousHash: NO_PREVIOUS_HASH,
			occurredAt: NOW.toISOString(),
			actorDeviceId: null,
			systemJob: null,
			objectId: null,
		})
	})

	it("links to the head and hashes everything but the hash itself", () => {
		const record = auditRecordOf({ sequence: "41", hash: "a".repeat(64) }, EVENT, NOW)
		const { hash, ...unhashed } = record

		expect(record.sequence).toBe(42)
		expect(record.previousHash).toBe("a".repeat(64))
		expect(hash).toBe(auditRecordHash(unhashed))
	})
})
