import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import type { Executor } from "../../../libs/database/database.service"
import type { ResourceLink } from "../types/clinical-record.types"

// datovy-model.md 13.2, ADR-050 bod 3, ADR-050 bod 11
@Injectable()
export class FhirResourceLinkRepository {
	async upsert(tx: postgres.TransactionSql, links: readonly ResourceLink[]): Promise<void> {
		if (links.length === 0) {
			return
		}
		const rows = links.map((link) => ({
			resource_type: link.resourceType,
			local_kind: link.localKind,
			local_id: link.localId,
			resource_id: link.resourceId,
		}))
		await tx`
			INSERT INTO fhir_resource_link ${tx(rows, "resource_type", "local_kind", "local_id", "resource_id")}
			ON CONFLICT (local_kind, local_id, resource_type)
			DO UPDATE SET resource_id = EXCLUDED.resource_id, written_at = now()
		`
	}

	async resourceIdOf(
		sql: Executor,
		link: Pick<ResourceLink, "resourceType" | "localKind" | "localId">,
	): Promise<string | undefined> {
		const [row] = await sql<{ resource_id: string }[]>`
			SELECT resource_id FROM fhir_resource_link
			WHERE local_kind = ${link.localKind} AND local_id = ${link.localId} AND resource_type = ${link.resourceType}
		`
		return row?.resource_id
	}

	async resourceIdsOf(
		sql: Executor,
		link: Pick<ResourceLink, "resourceType" | "localKind">,
		localIds: readonly string[],
	): Promise<ReadonlyMap<string, string>> {
		if (localIds.length === 0) {
			return new Map()
		}
		const rows = await sql<{ local_id: string; resource_id: string }[]>`
			SELECT local_id, resource_id FROM fhir_resource_link
			WHERE local_kind = ${link.localKind} AND resource_type = ${link.resourceType}
				AND local_id = ANY(${[...localIds]})
		`
		return new Map(rows.map((row) => [row.local_id, row.resource_id]))
	}

	async remove(tx: postgres.TransactionSql, localKind: string, localIds: readonly string[]): Promise<void> {
		if (localIds.length === 0) {
			return
		}
		await tx`DELETE FROM fhir_resource_link WHERE local_kind = ${localKind} AND local_id IN ${tx([...localIds])}`
	}
}
