import { DELIVERY_TARGET_STATE } from "@ansora/contracts"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import type { UnavailableTargetRow } from "../types/delivery.types"

const { ACTIVE, UNAVAILABLE, PAUSED } = DELIVERY_TARGET_STATE

// datovy-model.md 4 „Cíl doručení“, dorucovaci-jadro.md 5.3, CAP-023-R23, CAP-023-R24, CAP-023-R27
@Injectable()
export class DeliveryTargetRepository {
	constructor(private readonly database: DatabaseService) {}

	// datovy-model.md 4 „Cíl doručení“, CAP-023-R23, CAP-023-R24
	async isActive(tx: postgres.TransactionSql, code: string): Promise<boolean> {
		const [target] = await tx<{ state: string }[]>`SELECT state FROM delivery_target WHERE code = ${code} FOR SHARE`
		return target?.state === ACTIVE
	}

	// CAP-023-R24
	async markUnavailable(tx: postgres.TransactionSql, code: string, reason: string): Promise<boolean> {
		const changed = await tx<{ code: string }[]>`
			UPDATE delivery_target SET state = ${UNAVAILABLE}, reason = ${reason}, changed_at = now()
			WHERE code = ${code} AND state = ${ACTIVE}
			RETURNING code
		`
		return changed.length > 0
	}

	// CAP-023-R23, datovy-model.md 4 „Cíl doručení“
	async pause(tx: postgres.TransactionSql, code: string, reason: string): Promise<boolean> {
		const changed = await tx<{ code: string }[]>`
			UPDATE delivery_target SET state = ${PAUSED}, reason = ${reason}, changed_at = now(),
				unavailability_alerted_at = NULL
			WHERE code = ${code} AND state <> ${PAUSED}
			RETURNING code
		`
		return changed.length > 0
	}

	// CAP-023-R24, CAP-023-S13
	async release(tx: postgres.TransactionSql, code: string): Promise<boolean> {
		const changed = await tx<{ code: string }[]>`
			UPDATE delivery_target SET state = ${ACTIVE}, reason = NULL, changed_at = now(), unavailability_alerted_at = NULL
			WHERE code = ${code} AND state = ${UNAVAILABLE}
			RETURNING code
		`
		return changed.length > 0
	}

	// CAP-023-R27, CAP-023-S22, CAP-023-S23
	async markUnavailabilityAlerted(
		tx: postgres.TransactionSql,
		code: string,
		alertSeconds: number,
	): Promise<UnavailableTargetRow | undefined> {
		const [alerted] = await tx<UnavailableTargetRow[]>`
			UPDATE delivery_target SET unavailability_alerted_at = now()
			WHERE code = ${code} AND state = ${UNAVAILABLE} AND unavailability_alerted_at IS NULL
				AND changed_at <= now() - make_interval(secs => ${alertSeconds})
			RETURNING code, changed_at
		`
		return alerted
	}

	async unavailable(): Promise<UnavailableTargetRow[]> {
		return await this.database.sql<UnavailableTargetRow[]>`
			SELECT code, changed_at FROM delivery_target WHERE state = ${UNAVAILABLE} ORDER BY code
		`
	}
}
