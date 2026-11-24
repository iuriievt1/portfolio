import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import type { DraftDiscardConsent, DraftDiscardCounts } from "../types/draft-administration.types"

// datovy-model.md 4, CAP-015-R19, CAP-015-R20
@Injectable()
export class DraftDiscardConsentRepository {
	async insert(tx: postgres.TransactionSql, consent: DraftDiscardConsent, counts: DraftDiscardCounts): Promise<void> {
		await tx`
			INSERT INTO draft_discard_consent (
				id, operator_user_id, administrator_user_id, reason, granted_at, discarded_count, refused_count
			)
			VALUES (
				${consent.id}, ${consent.operatorUserId}, ${consent.administratorUserId}, ${consent.reason},
				${consent.grantedAt}, ${counts.discarded}, ${counts.refused}
			)
		`
	}
}
