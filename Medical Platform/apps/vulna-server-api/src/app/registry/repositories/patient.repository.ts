import { IDENTIFIER_SOURCE, PATIENT_ORIGIN } from "@ansora/vulna-domain"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import { startingWith } from "../../../libs/database/like-pattern"
import type { FoundPatient, PatientIdentifierRow, PatientRow } from "../types/registry.types"

// CAP-013-R07, CAP-013-R10, CAP-013-R17, datovy-model.md 7, CHG-175, CHG-176, CHG-182
@Injectable()
export class PatientRepository {
	constructor(private readonly database: DatabaseService) {}

	async byIdentifier(system: string, value: string, limit: number): Promise<FoundPatient[]> {
		const sql = this.database.sql
		return await this.withIdentifiers(
			await sql<PatientRow[]>`
				SELECT p.id, p.sex
				FROM patient_cache p
				WHERE EXISTS (
					SELECT 1 FROM patient_identifier i
					WHERE i.patient_id = p.id AND i.valid_until IS NULL AND i.system = ${system} AND i.value = ${value}
				)
				ORDER BY p.created_at, p.id
				LIMIT ${limit}
			`,
		)
	}

	// CAP-013-R07, CAP-013-R17, CHG-182
	async byIdentifierStart(system: string, start: string, limit: number): Promise<FoundPatient[]> {
		const sql = this.database.sql
		// 0037-patient-identifier-search.sql
		const searchedValue = sql`translate(i.value, ' /', '')`
		return await this.withIdentifiers(
			await sql<PatientRow[]>`
				SELECT p.id, p.sex
				FROM (
					SELECT i.patient_id, min(${searchedValue}) AS value
					FROM patient_identifier i
					WHERE i.valid_until IS NULL AND i.system = ${system}
						AND ${searchedValue} LIKE ${startingWith(start)}
					GROUP BY i.patient_id
					ORDER BY min(${searchedValue}), i.patient_id
					LIMIT ${limit}
				) matched
				JOIN patient_cache p ON p.id = matched.patient_id
				ORDER BY matched.value, p.id
			`,
		)
	}

	async byIds(ids: readonly string[]): Promise<FoundPatient[]> {
		if (ids.length === 0) {
			return []
		}
		const sql = this.database.sql
		return await this.withIdentifiers(
			await sql<PatientRow[]>`
				SELECT p.id, p.sex
				FROM patient_cache p
				WHERE p.id IN ${sql([...ids])}
			`,
		)
	}

	// CHG-175, CAP-024-R07
	async create(tx: postgres.TransactionSql, identifierId: string, identifier: PatientIdentifierRow): Promise<boolean> {
		await tx`
			INSERT INTO patient_cache (id, origin)
			VALUES (${identifier.patient_id}, ${PATIENT_ORIGIN.CREATED_IN_APP})
		`
		const inserted = await tx<{ id: string }[]>`
			INSERT INTO patient_identifier (id, patient_id, system, value, issuer, source)
			VALUES (
				${identifierId}, ${identifier.patient_id}, ${identifier.system}, ${identifier.value}, ${identifier.issuer},
				${IDENTIFIER_SOURCE.CREATED_IN_APP}
			)
			ON CONFLICT ON CONSTRAINT patient_identifier_uniq DO NOTHING
			RETURNING id
		`
		return inserted.length > 0
	}

	private async withIdentifiers(patients: readonly PatientRow[]): Promise<FoundPatient[]> {
		if (patients.length === 0) {
			return []
		}
		const sql = this.database.sql
		const identifiers = await sql<PatientIdentifierRow[]>`
			SELECT patient_id, system, value, issuer
			FROM patient_identifier
			WHERE patient_id IN ${sql(patients.map((patient) => patient.id))} AND valid_until IS NULL
			ORDER BY patient_id, created_at, id
		`
		return patients.map((patient) => ({
			patient,
			identifiers: identifiers.filter((identifier) => identifier.patient_id === patient.id),
		}))
	}
}
