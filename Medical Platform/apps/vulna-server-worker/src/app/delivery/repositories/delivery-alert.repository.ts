import { randomUUID } from "node:crypto"
import type { AdministratorAlertKind } from "@ansora/contracts"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import type { AlertedInstance } from "../types/delivery.types"

// datovy-model.md 4 „Upozornění správce“, CAP-023-R17, CAP-028-R15
@Injectable()
export class DeliveryAlertRepository {
	// administrator_alert_active_instance_uniq
	async raiseForInstance(
		tx: postgres.TransactionSql,
		kind: AdministratorAlertKind,
		instance: AlertedInstance,
		message: string,
	): Promise<string | undefined> {
		const [raised] = await tx<{ id: string }[]>`
			INSERT INTO administrator_alert (id, kind, message, delivery_id, delivery_instance_id)
			VALUES (${randomUUID()}, ${kind}, ${message}, ${instance.deliveryId}, ${instance.instanceId})
			ON CONFLICT (kind, delivery_instance_id) WHERE resolved_at IS NULL AND delivery_instance_id IS NOT NULL
			DO NOTHING
			RETURNING id
		`
		return raised?.id
	}

	// administrator_alert_active_target_uniq
	async raiseForTarget(
		tx: postgres.TransactionSql,
		kind: AdministratorAlertKind,
		targetCode: string,
		message: string,
	): Promise<string | undefined> {
		const [raised] = await tx<{ id: string }[]>`
			INSERT INTO administrator_alert (id, kind, message, target_code)
			VALUES (${randomUUID()}, ${kind}, ${message}, ${targetCode})
			ON CONFLICT (kind, target_code) WHERE resolved_at IS NULL AND target_code IS NOT NULL
			DO NOTHING
			RETURNING id
		`
		return raised?.id
	}

	// CAP-023-R24, CAP-023-R27
	async resolveForTarget(tx: postgres.TransactionSql, kind: AdministratorAlertKind, targetCode: string): Promise<void> {
		await tx`
			UPDATE administrator_alert SET resolved_at = now()
			WHERE kind = ${kind} AND target_code = ${targetCode} AND resolved_at IS NULL
		`
	}
}
