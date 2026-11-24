import { type AuditTrailRecord, auditRecordHash, FIRST_AUDIT_SEQUENCE, NO_PREVIOUS_HASH } from "./record"

export const AUDIT_CHAIN_OUTCOME = {
	INTACT: "intact",
	BROKEN: "broken",
} as const

export type AuditChainOutcome = (typeof AUDIT_CHAIN_OUTCOME)[keyof typeof AUDIT_CHAIN_OUTCOME]

export interface AuditChainCheck {
	outcome: AuditChainOutcome
	firstBrokenRecordId: string | undefined
	firstBrokenRecordAt: string | undefined
	checkedUntil: string | undefined
}

function linksToPrevious(record: AuditTrailRecord, previous: AuditTrailRecord | undefined): boolean {
	if (previous === undefined) {
		return record.sequence === FIRST_AUDIT_SEQUENCE && record.previousHash === NO_PREVIOUS_HASH
	}
	return record.sequence === previous.sequence + 1 && record.previousHash === previous.hash
}

// CAP-025-R21
export class AuditChainVerifier {
	private previous: AuditTrailRecord | undefined
	private broken: AuditTrailRecord | undefined

	accepts(record: AuditTrailRecord): boolean {
		if (this.broken !== undefined) {
			return false
		}
		const { hash, ...unhashed } = record
		if (!linksToPrevious(record, this.previous) || auditRecordHash(unhashed) !== hash) {
			this.broken = record
			return false
		}
		this.previous = record
		return true
	}

	result(): AuditChainCheck {
		return {
			outcome: this.broken === undefined ? AUDIT_CHAIN_OUTCOME.INTACT : AUDIT_CHAIN_OUTCOME.BROKEN,
			firstBrokenRecordId: this.broken?.id,
			firstBrokenRecordAt: this.broken?.occurredAt,
			checkedUntil: this.previous?.occurredAt,
		}
	}
}
