import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import { canonicalJson } from "../canonical-json"
import { AUDIT_CHAIN_OUTCOME, type AuditChainCheck, AuditChainVerifier } from "../chain"
import {
	AUDIT_ACTOR_KIND,
	AUDIT_OUTCOME,
	type AuditTrailRecord,
	auditRecordHash,
	NO_PREVIOUS_HASH,
	type UnhashedAuditRecord,
} from "../record"

function verifyAuditChain(records: readonly AuditTrailRecord[]): AuditChainCheck {
	const verifier = new AuditChainVerifier()
	records.every((record) => verifier.accepts(record))
	return verifier.result()
}

function chainOf(count: number): AuditTrailRecord[] {
	const records: AuditTrailRecord[] = []
	for (let sequence = 1; sequence <= count; sequence += 1) {
		const unhashed: UnhashedAuditRecord = {
			id: `00000000-0000-4000-8000-00000000000${sequence}`,
			sequence,
			occurredAt: `2026-09-21T10:00:0${sequence}.000Z`,
			eventType: "configuration-changed",
			actorKind: AUDIT_ACTOR_KIND.USER,
			actorUserId: "11111111-1111-4111-8111-111111111111",
			actorDeviceId: null,
			systemJob: null,
			sessionId: null,
			objectId: null,
			sourceAddress: sequence === 1 ? null : "192.0.2.10",
			outcome: AUDIT_OUTCOME.SUCCESS,
			details: { version: sequence + 1, reason: "test" },
			previousHash: records.at(-1)?.hash ?? NO_PREVIOUS_HASH,
		}
		records.push({ ...unhashed, hash: auditRecordHash(unhashed) })
	}
	return records
}

describe("audit chain", () => {
	it("hashes a record independently of the key order of its details", () => {
		const [record] = chainOf(1)
		if (record === undefined) {
			throw new Error("no record")
		}
		const { hash, ...unhashed } = record
		expect(auditRecordHash({ ...unhashed, details: { reason: "test", version: 2 } })).toBe(hash)
		expect(hash).toMatch(/^[0-9a-f]{64}$/)
	})

	it("confirms an untouched chain and reports the time of the last record", () => {
		const records = chainOf(3)
		expect(verifyAuditChain(records)).toEqual({
			outcome: AUDIT_CHAIN_OUTCOME.INTACT,
			firstBrokenRecordId: undefined,
			checkedUntil: "2026-09-21T10:00:03.000Z",
		})
		expect(verifyAuditChain([])).toEqual({
			outcome: AUDIT_CHAIN_OUTCOME.INTACT,
			firstBrokenRecordId: undefined,
			checkedUntil: undefined,
		})
	})

	it("CAP-025-S13 finds the place where a record was deleted from the middle", () => {
		const [first, , third] = chainOf(3)
		if (first === undefined || third === undefined) {
			throw new Error("no records")
		}
		expect(verifyAuditChain([first, third])).toEqual({
			outcome: AUDIT_CHAIN_OUTCOME.BROKEN,
			firstBrokenRecordId: third.id,
			firstBrokenRecordAt: third.occurredAt,
			checkedUntil: first.occurredAt,
		})
	})

	it("finds a record changed after it was written", () => {
		const records = chainOf(3)
		const tampered = records.map((record) =>
			record.sequence === 2 ? { ...record, details: { version: 99, reason: "test" } } : record,
		)
		expect(verifyAuditChain(tampered).firstBrokenRecordId).toBe(records[1]?.id)
	})

	it("finds a record inserted without the chain", () => {
		const records = chainOf(2)
		const [first] = records
		if (first === undefined) {
			throw new Error("no record")
		}
		const inserted: AuditTrailRecord = {
			...first,
			id: "99999999-9999-4999-8999-999999999999",
			sequence: 2,
			previousHash: first.hash,
		}
		expect(verifyAuditChain([first, inserted]).firstBrokenRecordId).toBe(inserted.id)
	})

	it("keeps the hash of a record written before records carried a source address", () => {
		const [record] = chainOf(1)
		if (record === undefined) {
			throw new Error("no record")
		}
		const legacy = canonicalJson({
			id: record.id,
			sequence: record.sequence,
			occurred_at: record.occurredAt,
			event_type: record.eventType,
			actor_kind: record.actorKind,
			actor_user_id: record.actorUserId,
			actor_device_id: record.actorDeviceId,
			system_job: record.systemJob,
			session_id: record.sessionId,
			object_id: record.objectId,
			outcome: record.outcome,
			details: record.details,
			previous_hash: record.previousHash,
		})
		expect(record.hash).toBe(createHash("sha256").update(legacy).digest("hex"))
	})

	it("CAP-025-R04 finds a source address changed after the record was written", () => {
		const records = chainOf(3)
		const tampered = records.map((record) =>
			record.sequence === 2 ? { ...record, sourceAddress: "198.51.100.7" } : record,
		)
		expect(verifyAuditChain(tampered).firstBrokenRecordId).toBe(records[1]?.id)
	})
})
