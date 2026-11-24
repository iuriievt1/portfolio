import type { BodySite } from "@ansora/vulna-domain"
import { ACQUISITION_STATE } from "@ansora/vulna-domain"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import type { Executor } from "../../../libs/database/database.service"
import type { BodySiteRow } from "../types/finding.types"

const COLUMNS = ["acquisition_id", "region_code", "laterality", "view", "x", "y", "body_diagram_version"] as const

// CAP-016-R03, CAP-016-R04, CAP-016-R08, CAP-016-R14
@Injectable()
export class BodySiteRepository {
	async upsert(tx: postgres.TransactionSql, acquisitionId: string, site: BodySite): Promise<void> {
		await tx`
			INSERT INTO body_site (acquisition_id, region_code, laterality, view, x, y, body_diagram_version)
			VALUES (
				${acquisitionId}, ${site.regionCode}, ${site.laterality}, ${site.view}, ${site.x}, ${site.y},
				${site.bodyDiagramVersion}
			)
			ON CONFLICT (acquisition_id) DO UPDATE SET
				region_code = EXCLUDED.region_code, laterality = EXCLUDED.laterality, view = EXCLUDED.view,
				x = EXCLUDED.x, y = EXCLUDED.y, body_diagram_version = EXCLUDED.body_diagram_version
		`
	}

	async findByAcquisition(sql: Executor, acquisitionId: string): Promise<BodySiteRow | undefined> {
		const [row] = await sql<BodySiteRow[]>`
			SELECT ${sql(COLUMNS)} FROM body_site WHERE acquisition_id = ${acquisitionId}
		`
		return row
	}

	// CAP-016-R17, CAP-020-R20
	async lastClosedOf(sql: Executor, findingId: string): Promise<BodySiteRow | undefined> {
		const [row] = await sql<BodySiteRow[]>`
			SELECT body_site.acquisition_id, body_site.region_code, body_site.laterality, body_site.view,
				body_site.x, body_site.y, body_site.body_diagram_version
			FROM acquisition
			JOIN body_site ON body_site.acquisition_id = acquisition.id
			WHERE acquisition.finding_id = ${findingId} AND acquisition.state <> ${ACQUISITION_STATE.DRAFT}
			ORDER BY acquisition.closed_at DESC, acquisition.id DESC
			LIMIT 1
		`
		return row
	}

	async delete(tx: postgres.TransactionSql, acquisitionId: string): Promise<void> {
		await tx`DELETE FROM body_site WHERE acquisition_id = ${acquisitionId}`
	}
}
