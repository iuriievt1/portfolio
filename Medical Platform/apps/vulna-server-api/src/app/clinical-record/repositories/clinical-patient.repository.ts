import type { ClinicalPatient } from "@ansora/vulna-domain"
import { Injectable } from "@nestjs/common"
import type { Executor } from "../../../libs/database/database.service"
import type { ClinicalIdentifierRow, ClinicalPatientRow } from "../types/clinical-record.types"

// ADR-050 bod 9, CAP-024-R07, CHG-175
@Injectable()
export class ClinicalPatientRepository {
	async patientOf(sql: Executor, patientId: string): Promise<ClinicalPatient | undefined> {
		const [row] = await sql<ClinicalPatientRow[]>`
			SELECT id, family_name, given_name, birth_date::text AS birth_date, sex, demographics_revision
			FROM patient_cache WHERE id = ${patientId}
		`
		if (row === undefined) {
			return undefined
		}
		const identifiers = await sql<ClinicalIdentifierRow[]>`
			SELECT system, value, issuer, valid_until FROM patient_identifier
			WHERE patient_id = ${patientId}
			ORDER BY created_at, id
		`
		return {
			patientId: row.id,
			familyName: row.family_name ?? undefined,
			givenName: row.given_name ?? undefined,
			birthDate: row.birth_date ?? undefined,
			sex: row.sex ?? undefined,
			identifiers: identifiers.map((identifier) => ({
				system: identifier.system,
				value: identifier.value,
				issuer: identifier.issuer ?? undefined,
				validUntil: identifier.valid_until?.toISOString(),
			})),
			demographicsRevision: row.demographics_revision,
		}
	}
}
