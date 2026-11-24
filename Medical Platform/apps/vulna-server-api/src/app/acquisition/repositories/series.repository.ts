import { randomUUID } from "node:crypto"
import { uidOfUuid } from "@ansora/vulna-domain"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { lockEncounterClosing } from "../../../libs/database/encounter-closing-lock"
import { FIRST_SERIES_NUMBER } from "../constants/acquisition.constants"
import type { DocumentSeriesRow, SeriesOwner, SeriesRow } from "../types/acquisition.types"

const COLUMNS = ["id", "series_instance_uid", "series_number"] as const

// datovy-model.md 3, CAP-021-R11, integrace-dicom.md 4
@Injectable()
export class SeriesRepository {
	// ADR-050, CAP-021-R11
	async lockEncounter(tx: postgres.TransactionSql, encounterId: string): Promise<void> {
		await lockEncounterClosing(tx, encounterId)
	}

	// CAP-021-R11, CAP-021-S11, NAB-370
	async assign(tx: postgres.TransactionSql, owner: SeriesOwner, id: string = randomUUID()): Promise<SeriesRow> {
		const existing = await this.findOwned(tx, owner)
		if (existing !== undefined) {
			return existing
		}
		const [row] = await tx<SeriesRow[]>`
			INSERT INTO series (id, encounter_id, finding_id, document_id, series_instance_uid, series_number)
			SELECT
				${id}, ${owner.encounterId}, ${owner.findingId ?? null}, ${owner.documentId ?? null}, ${uidOfUuid(id)},
				coalesce(max(series_number), 0) + ${FIRST_SERIES_NUMBER}
			FROM series WHERE encounter_id = ${owner.encounterId}
			RETURNING ${tx(COLUMNS)}
		`
		if (row === undefined) {
			throw new Error(`the series of encounter ${owner.encounterId} was not written`)
		}
		return row
	}

	// CAP-021-R39, ADR-050 (doplnění D33) bod 3
	async findOfDocument(tx: postgres.TransactionSql, documentId: string): Promise<DocumentSeriesRow | undefined> {
		const [row] = await tx<DocumentSeriesRow[]>`
			SELECT encounter_id, series_instance_uid FROM series WHERE document_id = ${documentId}
		`
		return row
	}

	// ADR-050 (doplnění D33) bod 3, CAP-015-R17, CAP-014-R25
	async removeOfDocument(tx: postgres.TransactionSql, documentId: string): Promise<void> {
		await tx`DELETE FROM series WHERE document_id = ${documentId}`
	}

	private async findOwned(tx: postgres.TransactionSql, owner: SeriesOwner): Promise<SeriesRow | undefined> {
		const [row] =
			owner.findingId === undefined
				? await tx<SeriesRow[]>`SELECT ${tx(COLUMNS)} FROM series WHERE document_id = ${owner.documentId}`
				: await tx<SeriesRow[]>`
					SELECT ${tx(COLUMNS)} FROM series WHERE encounter_id = ${owner.encounterId} AND finding_id = ${owner.findingId}
				`
		return row
	}
}
