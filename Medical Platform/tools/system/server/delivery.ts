import { DELIVERY_INSTANCE_STATE, DELIVERY_STATE, type DeliveryInstanceState } from "@ansora/contracts"
import type postgres from "@veevoy/postgres"
import { eventually } from "../support/eventually"

// CAP-023-R09, datovy-model.md 4
const SETTLED_STATES: readonly DeliveryInstanceState[] = [
	DELIVERY_INSTANCE_STATE.CONFIRMED,
	DELIVERY_INSTANCE_STATE.PERMANENTLY_FAILED,
	DELIVERY_INSTANCE_STATE.HELD_FOR_REVIEW,
	DELIVERY_INSTANCE_STATE.CLOSED_BY_ADMINISTRATOR,
]

export interface DeliveredInstance {
	state: DeliveryInstanceState
	lastDimseStatus: string | null
	isRetentionAnchored: boolean
	sopClassUid: string
	sopInstanceUid: string
}

interface DeliveryRow {
	delivery_state: string
	reason: string | null
	state: DeliveryInstanceState | null
	last_dimse_status: string | null
	is_retention_anchored: boolean | null
	sop_class_uid: string | null
	sop_instance_uid: string | null
}

function deliveredOf(rows: readonly DeliveryRow[]): DeliveredInstance[] {
	return rows.flatMap((row) =>
		row.state === null || row.sop_class_uid === null || row.sop_instance_uid === null
			? []
			: [
					{
						state: row.state,
						lastDimseStatus: row.last_dimse_status,
						isRetentionAnchored: row.is_retention_anchored === true,
						sopClassUid: row.sop_class_uid,
						sopInstanceUid: row.sop_instance_uid,
					},
				],
	)
}

async function deliveryRowsOf(sql: postgres.Sql, acquisitionId: string): Promise<DeliveryRow[]> {
	return await sql<DeliveryRow[]>`
		SELECT d.state AS delivery_state, d.reason, di.state, di.last_dimse_status,
			di.retention_anchor IS NOT NULL AS is_retention_anchored, a.sop_class_uid, a.sop_instance_uid
		FROM delivery d
		LEFT JOIN delivery_instance di ON di.delivery_id = d.id
		LEFT JOIN artifact a ON a.id = di.artifact_id
		WHERE d.acquisition_id = ${acquisitionId}
		ORDER BY a.sop_instance_uid
	`
}

function isSettled(delivered: readonly DeliveredInstance[], instanceCount: number): boolean {
	return delivered.length === instanceCount && delivered.every((instance) => SETTLED_STATES.includes(instance.state))
}

// CAP-021-R03, CAP-023-R09, ADR-024
export async function settledDeliveryOf(
	sql: postgres.Sql,
	acquisitionId: string,
	instanceCount: number,
	timeoutMilliseconds: number,
): Promise<DeliveredInstance[]> {
	const rows = await eventually(
		`the settled delivery of ${acquisitionId}`,
		async () => {
			const current = await deliveryRowsOf(sql, acquisitionId)
			const failed = current.find((row) => row.delivery_state === DELIVERY_STATE.ASSEMBLY_FAILED)
			if (failed !== undefined) {
				throw new Error(`the assembly of ${acquisitionId} failed: ${failed.reason}`)
			}
			return current
		},
		(current) => isSettled(deliveredOf(current), instanceCount),
		timeoutMilliseconds,
	)
	return deliveredOf(rows)
}
