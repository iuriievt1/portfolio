import { randomUUID } from "node:crypto"
import { DELIVERY_STATE, DELIVERY_TARGET } from "@ansora/contracts"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"

// datovy-model.md 4 „Doručení“, ADR-005 ř. 21, 36
@Injectable()
export class DeliveryRepository {
	// CAP-021-R03, CAP-021-R29, Q-065
	async createWaiting(tx: postgres.TransactionSql, acquisitionId: string): Promise<void> {
		await this.createWaitingAll(tx, [acquisitionId])
	}

	// CAP-021-R03, Q-065
	async createWaitingAll(tx: postgres.TransactionSql, acquisitionIds: readonly string[]): Promise<void> {
		if (acquisitionIds.length === 0) {
			return
		}
		const rows = acquisitionIds.map((acquisitionId) => ({
			id: randomUUID(),
			acquisition_id: acquisitionId,
			target: DELIVERY_TARGET.PACS,
			state: DELIVERY_STATE.WAITING_FOR_ASSEMBLY,
		}))
		await tx`INSERT INTO delivery ${tx(rows, "id", "acquisition_id", "target", "state")}`
	}
}
