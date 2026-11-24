import { DELIVERY_TARGET } from "@ansora/contracts"
import { ACQUISITION_STATE } from "@ansora/vulna-domain"
import { Injectable } from "@nestjs/common"
import { FILE_STATUS } from "../../../libs/common/constants/file-status.constants"
import { acquisitionSeriesCondition } from "../../../libs/common/utils/acquisition-series"
import { DatabaseService } from "../../../libs/database/database.service"
import { PATIENT_LINK } from "../constants/assembly.constants"
import type {
	AssemblyImage,
	AssemblyImageRow,
	AssemblyRecordRow,
	FoundRecord,
	PatientIdentifierRow,
} from "../types/assembly.types"
import { assemblyImageOf, foundRecordOf } from "../utils/assembly-record"

// integrace-dicom.md 2, 5, datovy-model.md 4 „Pořízení“, ADR-054 bod 4
@Injectable()
export class AssemblyRecordRepository {
	constructor(private readonly database: DatabaseService) {}

	async find(acquisitionId: string): Promise<FoundRecord | undefined> {
		const sql = this.database.sql
		const [row] = await sql<AssemblyRecordRow[]>`
			SELECT a.id, a.kind, a.patient_id, a.started_at, a.file_count, a.first_instance_number, a.finding_id,
				finding.wound_number, document.id AS document_id,
				operator.family_name AS operator_family_name, operator.given_name AS operator_given_name,
				device.hw_id AS closing_hardware_id,
				encounter.study_instance_uid, encounter.study_id, encounter.accession_number,
				encounter.date::text AS encounter_date, encounter.started_at AS encounter_started_at,
				series.series_instance_uid, series.series_number,
				patient.family_name, patient.given_name, patient.birth_date::text AS birth_date, patient.sex,
				patient_link.resource_id AS patient_resource_id,
				delivery.id AS delivery_id, delivery.state AS delivery_state
			FROM acquisition a
			JOIN app_user operator ON operator.id = a.operator_user_id
			JOIN encounter ON encounter.id = a.encounter_id
			JOIN patient_cache patient ON patient.id = a.patient_id
			LEFT JOIN device ON device.id = a.closing_device_id
			LEFT JOIN finding ON finding.id = a.finding_id
			LEFT JOIN document ON document.acquisition_id = a.id
			LEFT JOIN series ON ${acquisitionSeriesCondition(sql)}
			LEFT JOIN fhir_resource_link patient_link ON patient_link.resource_type = ${PATIENT_LINK.RESOURCE_TYPE}
				AND patient_link.local_kind = ${PATIENT_LINK.LOCAL_KIND} AND patient_link.local_id = a.patient_id::text
			LEFT JOIN delivery ON delivery.acquisition_id = a.id AND delivery.target = ${DELIVERY_TARGET.PACS}
			WHERE a.id = ${acquisitionId} AND a.state <> ${ACQUISITION_STATE.DRAFT}
		`
		if (row === undefined) {
			return undefined
		}
		const identifiers = await sql<PatientIdentifierRow[]>`
			SELECT identifier.system, identifier.value, identifier.issuer, identifier.valid_until
			FROM patient_identifier identifier
			WHERE identifier.patient_id = ${row.patient_id}
			ORDER BY identifier.created_at, identifier.id
		`
		return foundRecordOf(row, identifiers)
	}

	// CAP-021-R25, CAP-015-R33, CAP-021-R34
	async imagesOf(acquisitionId: string): Promise<AssemblyImage[]> {
		const rows = await this.database.sql<AssemblyImageRow[]>`
			SELECT id, sequence, binary_object_id, edit_kind
			FROM image
			WHERE acquisition_id = ${acquisitionId} AND status = ${FILE_STATUS.RECEIVED}
			ORDER BY sequence
		`
		return rows.map(assemblyImageOf)
	}

	// datovy-model.md 4 „Pořízení“
	async markAssembling(acquisitionId: string): Promise<void> {
		await this.database.sql`
			UPDATE acquisition SET state = ${ACQUISITION_STATE.ASSEMBLING}
			WHERE id = ${acquisitionId} AND state = ${ACQUISITION_STATE.RECEIVED}
		`
	}
}
