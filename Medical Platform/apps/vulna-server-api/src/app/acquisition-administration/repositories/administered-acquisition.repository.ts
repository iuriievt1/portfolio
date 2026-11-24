import { identifierSearchTextOf } from "@ansora/contracts"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import { cursorMomentOf, decodeMomentCursor, momentPageOf, olderThan } from "../../infra/utils/cursor-moment"
import type {
	AcquisitionInstanceRow,
	AdministeredAcquisitionPage,
	AdministeredAcquisitionQuery,
	AdministeredAcquisitionRow,
} from "../types/acquisition-administration.types"

type Fragment = postgres.PendingQuery<postgres.Row[]>

// datovy-model.md 3, CAP-021-R11, CAP-021-R39
function administeredAcquisitions(sql: postgres.Sql): Fragment {
	return sql`
		SELECT a.id, a.kind, a.state, a.file_count, a.operator_user_id, a.closing_device_id, a.patient_id,
			a.encounter_id, a.started_at, a.closed_at,
			version.id AS configuration_version, version.created_at AS configuration_created_at,
			version.author_user_id AS configuration_author_user_id, version.reason AS configuration_reason,
			encounter.study_instance_uid,
			coalesce(
				(SELECT series.series_instance_uid FROM series JOIN document ON document.id = series.document_id
					WHERE document.acquisition_id = a.id),
				(SELECT series.series_instance_uid FROM series
					WHERE series.encounter_id = a.encounter_id AND series.finding_id = a.finding_id)
			) AS series_instance_uid,
			${cursorMomentOf(sql, sql`a.started_at`)} AS started_at_moment
		FROM acquisition a
		JOIN configuration_version version ON version.id = a.configuration_version_id
		JOIN encounter ON encounter.id = a.encounter_id
	`
}

function byState(sql: postgres.Sql, query: AdministeredAcquisitionQuery): Fragment {
	return query.state === undefined ? sql`TRUE` : sql`a.state = ${query.state}`
}

// 0044-acquisition-search.sql, CHG-182
function byPatient(sql: postgres.Sql, query: AdministeredAcquisitionQuery): Fragment {
	if (query.patientIdentifier === undefined) {
		return sql`TRUE`
	}
	return sql`a.patient_id IN (
		SELECT identifier.patient_id FROM patient_identifier identifier
		WHERE identifier.valid_until IS NULL
			AND translate(identifier.value, ' /', '') = ${identifierSearchTextOf(query.patientIdentifier)}
	)`
}

function startedFrom(sql: postgres.Sql, query: AdministeredAcquisitionQuery): Fragment {
	return query.from === undefined ? sql`TRUE` : sql`a.started_at >= ${query.from}::text::timestamptz`
}

function startedUntil(sql: postgres.Sql, query: AdministeredAcquisitionQuery): Fragment {
	return query.to === undefined ? sql`TRUE` : sql`a.started_at <= ${query.to}::text::timestamptz`
}

// CAP-004-R10, administration.yaml searchAcquisitions, getAcquisitionForAdministration, ADR-012
@Injectable()
export class AdministeredAcquisitionRepository {
	constructor(private readonly database: DatabaseService) {}

	async page(query: AdministeredAcquisitionQuery): Promise<AdministeredAcquisitionPage> {
		const sql = this.database.sql
		const rows = await sql<AdministeredAcquisitionRow[]>`
			${administeredAcquisitions(sql)}
			WHERE ${byState(sql, query)} AND ${byPatient(sql, query)}
				AND ${startedFrom(sql, query)} AND ${startedUntil(sql, query)}
				AND ${olderThan(sql, sql`a.started_at, a.id`, decodeMomentCursor(query.cursor))}
			ORDER BY a.started_at DESC, a.id DESC
			LIMIT ${query.limit + 1}
		`
		return momentPageOf(rows, query.limit, (row) => row.started_at_moment)
	}

	async findById(acquisitionId: string): Promise<AdministeredAcquisitionRow | undefined> {
		const sql = this.database.sql
		const [row] = await sql<AdministeredAcquisitionRow[]>`
			${administeredAcquisitions(sql)}
			WHERE a.id = ${acquisitionId}
		`
		return row
	}

	// datovy-model.md 4, NAB-313
	async instancesOf(acquisitionId: string): Promise<AcquisitionInstanceRow[]> {
		return await this.database.sql<AcquisitionInstanceRow[]>`
			SELECT artifact.sop_instance_uid, artifact.sop_class_uid, instance.state AS delivery_state
			FROM artifact
			JOIN delivery_instance instance ON instance.artifact_id = artifact.id
			WHERE artifact.acquisition_id = ${acquisitionId}
			ORDER BY artifact.sop_instance_uid
		`
	}
}
