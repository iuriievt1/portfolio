import { randomUUID } from "node:crypto"
import { ENCOUNTER_STATUS } from "@ansora/contracts"
import {
	type CachedIdentifier,
	demographicsDiffer,
	ENCOUNTER_SOURCE,
	hasIdentifierChanges,
	IDENTIFIER_SOURCE,
	type Identifier,
	identifierChangesOf,
	identifierKeyOf,
	PATIENT_ORIGIN,
	type PatientGroup,
	type PatientIdentifier,
	type PatientRecord,
	type RegistryRecordSource,
	type ScheduledEncounter,
	sameIdentifiers,
	uniqueIdentifiers,
} from "@ansora/vulna-domain"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import { UPSERT_OUTCOME, type UpsertOutcome } from "../constants/registry-sync.constants"
import type {
	DocumentedPatient,
	EncounterRow,
	IdentifierRow,
	PatientRow,
	PatientUpsert,
	StoredIdentifierRow,
} from "../types/registry-sync.types"

function identifierOf(row: StoredIdentifierRow): Identifier {
	return { system: row.system, value: row.value, issuer: row.issuer ?? undefined }
}

function cachedRecordOf(row: PatientRow, identifiers: readonly IdentifierRow[]): PatientRecord {
	return {
		identifiers: identifiers.map(identifierOf),
		familyName: row.family_name ?? undefined,
		givenName: row.given_name ?? undefined,
		birthDate: row.birth_date ?? undefined,
		sex: row.sex ?? undefined,
	}
}

function cachedIdentifierOf(row: IdentifierRow): CachedIdentifier {
	return {
		identifier: identifierOf(row),
		isCurrent: row.valid_until === null,
		isFromRegistry: row.source !== IDENTIFIER_SOURCE.CREATED_IN_APP,
	}
}

// CAP-024-R01, CAP-024-R07, CAP-024-R13, CAP-024-R14, datovy-model.md 7
@Injectable()
export class RegistryCacheRepository {
	constructor(private readonly database: DatabaseService) {}

	async documentedPatients(): Promise<DocumentedPatient[]> {
		const rows = await this.database.sql<IdentifierRow[]>`
			SELECT i.patient_id, i.system, i.value, i.issuer, i.source, i.valid_until
			FROM patient_identifier i
			JOIN patient_cache p ON p.id = i.patient_id
			WHERE p.origin = ${PATIENT_ORIGIN.DOCUMENTED_BY_VULNA}
				AND i.valid_until IS NULL
				AND i.source <> ${IDENTIFIER_SOURCE.CREATED_IN_APP}
			ORDER BY i.patient_id, i.created_at, i.id
		`
		const byPatient = new Map<string, DocumentedPatient>()
		for (const row of rows) {
			const patient = byPatient.get(row.patient_id) ?? { patientId: row.patient_id, identifiers: [] }
			patient.identifiers.push(identifierOf(row))
			byPatient.set(row.patient_id, patient)
		}
		return [...byPatient.values()]
	}

	async upsertPatient(tx: postgres.TransactionSql, group: PatientGroup, runId: string): Promise<PatientUpsert> {
		const owners = await this.ownersOf(tx, group.identifiers)
		const [patientId] = [...new Set(owners.values())]
		if (patientId === undefined) {
			return { patientId: await this.insertPatient(tx, group, runId), outcome: UPSERT_OUTCOME.ADDED }
		}
		const freeIdentifiers = group.identifiers.filter((identifier) => {
			const owner = owners.get(identifierKeyOf(identifier))
			return owner === undefined || owner === patientId
		})
		const isChanged = await this.updatePatient(tx, patientId, { ...group, identifiers: freeIdentifiers }, runId)
		return { patientId, outcome: isChanged ? UPSERT_OUTCOME.CHANGED : UPSERT_OUTCOME.UNCHANGED }
	}

	async upsertScheduledEncounter(
		tx: postgres.TransactionSql,
		encounter: ScheduledEncounter,
		patientId: string,
		runId: string,
	): Promise<UpsertOutcome> {
		const [existing] = await tx<EncounterRow[]>`
			SELECT id, source, status FROM encounter WHERE study_instance_uid = ${encounter.studyInstanceUid} FOR UPDATE
		`
		if (existing === undefined) {
			await this.insertScheduledEncounter(tx, encounter, patientId, runId)
			return UPSERT_OUTCOME.ADDED
		}
		await tx`UPDATE encounter SET last_sync_run_id = ${runId} WHERE id = ${existing.id}`
		if (existing.source !== ENCOUNTER_SOURCE.WORKLIST || existing.status !== ENCOUNTER_STATUS.PLANNED) {
			return UPSERT_OUTCOME.UNCHANGED
		}
		const isFieldChange = await this.updateScheduledFields(tx, existing.id, encounter, patientId)
		const isIdentifierChange = await this.replaceEncounterIdentifiers(tx, existing.id, encounter.identifiers)
		return isFieldChange || isIdentifierChange ? UPSERT_OUTCOME.CHANGED : UPSERT_OUTCOME.UNCHANGED
	}

	// CAP-024-R08, CAP-024-R13
	async removeUnseen(tx: postgres.TransactionSql, runId: string): Promise<void> {
		await tx`
			DELETE FROM encounter
			WHERE source = ${ENCOUNTER_SOURCE.WORKLIST}
				AND status = ${ENCOUNTER_STATUS.PLANNED}
				AND last_sync_run_id IS DISTINCT FROM ${runId}
		`
		await tx`
			DELETE FROM patient_cache p
			WHERE p.origin = ${PATIENT_ORIGIN.REGISTRY}
				AND p.last_sync_run_id IS DISTINCT FROM ${runId}
				AND NOT EXISTS (SELECT 1 FROM encounter e WHERE e.patient_id = p.id)
		`
	}

	private async insertScheduledEncounter(
		tx: postgres.TransactionSql,
		encounter: ScheduledEncounter,
		patientId: string,
		runId: string,
	): Promise<void> {
		const encounterId = randomUUID()
		await tx`
			INSERT INTO encounter (
				id, patient_id, source, status, date, scheduled_time, study_instance_uid, accession_number, last_sync_run_id
			) VALUES (
				${encounterId}, ${patientId}, ${ENCOUNTER_SOURCE.WORKLIST}, ${ENCOUNTER_STATUS.PLANNED},
				${encounter.scheduledDate}::date, ${encounter.scheduledTime ?? null}::time, ${encounter.studyInstanceUid},
				${encounter.accessionNumber ?? null}, ${runId}
			)
		`
		await this.insertEncounterIdentifiers(tx, encounterId, encounter.identifiers)
	}

	private async updateScheduledFields(
		tx: postgres.TransactionSql,
		encounterId: string,
		encounter: ScheduledEncounter,
		patientId: string,
	): Promise<boolean> {
		const changed = await tx`
			UPDATE encounter
			SET patient_id = ${patientId},
				date = ${encounter.scheduledDate}::date,
				scheduled_time = ${encounter.scheduledTime ?? null}::time,
				accession_number = ${encounter.accessionNumber ?? null},
				updated_at = now()
			WHERE id = ${encounterId}
				AND (patient_id, date, scheduled_time, accession_number) IS DISTINCT FROM (
					${patientId}::uuid, ${encounter.scheduledDate}::date, ${encounter.scheduledTime ?? null}::time,
					${encounter.accessionNumber ?? null}::text
				)
			RETURNING id
		`
		return changed.length > 0
	}

	// integrace-dicom.md 5.9
	private async replaceEncounterIdentifiers(
		tx: postgres.TransactionSql,
		encounterId: string,
		identifiers: readonly Identifier[],
	): Promise<boolean> {
		const stored = await tx<StoredIdentifierRow[]>`
			SELECT system, value, issuer FROM encounter_identifier WHERE encounter_id = ${encounterId}
		`
		if (sameIdentifiers(stored.map(identifierOf), identifiers)) {
			return false
		}
		await tx`DELETE FROM encounter_identifier WHERE encounter_id = ${encounterId}`
		await this.insertEncounterIdentifiers(tx, encounterId, identifiers)
		return true
	}

	private async insertEncounterIdentifiers(
		tx: postgres.TransactionSql,
		encounterId: string,
		identifiers: readonly Identifier[],
	): Promise<void> {
		for (const identifier of uniqueIdentifiers(identifiers)) {
			await tx`
				INSERT INTO encounter_identifier (id, encounter_id, system, value, issuer, source)
				VALUES (
					${randomUUID()}, ${encounterId}, ${identifier.system}, ${identifier.value}, ${identifier.issuer ?? null},
					${IDENTIFIER_SOURCE.WORKLIST}
				)
			`
		}
	}

	private async ownersOf(
		tx: postgres.TransactionSql,
		identifiers: readonly PatientIdentifier[],
	): Promise<Map<string, string>> {
		const owners = new Map<string, string>()
		for (const identifier of identifiers) {
			const [row] = await tx<{ patient_id: string }[]>`
				SELECT patient_id FROM patient_identifier
				WHERE system = ${identifier.system}
					AND value = ${identifier.value}
					AND issuer IS NOT DISTINCT FROM ${identifier.issuer ?? null}::text
			`
			if (row !== undefined) {
				owners.set(identifierKeyOf(identifier), row.patient_id)
			}
		}
		return owners
	}

	private async insertPatient(tx: postgres.TransactionSql, group: PatientGroup, runId: string): Promise<string> {
		const patientId = randomUUID()
		const { record } = group
		await tx`
			INSERT INTO patient_cache (
				id, family_name, given_name, birth_date, sex, origin, last_sync_run_id
			) VALUES (
				${patientId}, ${record.familyName ?? null}, ${record.givenName ?? null}, ${record.birthDate ?? null}::date,
				${record.sex ?? null}, ${PATIENT_ORIGIN.REGISTRY}, ${runId}
			)
		`
		for (const identifier of group.identifiers) {
			await this.insertIdentifier(tx, patientId, identifier, group.source)
		}
		return patientId
	}

	private async updatePatient(
		tx: postgres.TransactionSql,
		patientId: string,
		group: PatientGroup,
		runId: string,
	): Promise<boolean> {
		const [row] = await tx<PatientRow[]>`
			SELECT id, family_name, given_name, birth_date::text AS birth_date, sex
			FROM patient_cache WHERE id = ${patientId} FOR UPDATE
		`
		if (row === undefined) {
			throw new Error(`patient ${patientId} owns an identifier but has no cache row`)
		}
		const identifierRows = await tx<IdentifierRow[]>`
			SELECT patient_id, system, value, issuer, source, valid_until
			FROM patient_identifier WHERE patient_id = ${patientId}
		`
		const changes = identifierChangesOf(identifierRows.map(cachedIdentifierOf), group.identifiers)
		const isDemographicsChange = demographicsDiffer(cachedRecordOf(row, identifierRows), group.record)
		for (const identifier of changes.added) {
			await this.insertIdentifier(tx, patientId, identifier, group.source)
		}
		for (const identifier of changes.restored) {
			await this.setIdentifierValidity(tx, identifier, null)
		}
		for (const identifier of changes.retired) {
			await this.setIdentifierValidity(tx, identifier, new Date())
		}
		const isChanged = isDemographicsChange || hasIdentifierChanges(changes)
		const { record } = group
		await tx`
			UPDATE patient_cache
			SET family_name = ${record.familyName ?? null},
				given_name = ${record.givenName ?? null},
				birth_date = ${record.birthDate ?? null}::date,
				sex = ${record.sex ?? null},
				demographics_revision = demographics_revision + ${isChanged ? 1 : 0},
				last_sync_run_id = ${runId},
				updated_at = CASE WHEN ${isChanged}::boolean THEN now() ELSE updated_at END
			WHERE id = ${patientId}
		`
		return isChanged
	}

	private async insertIdentifier(
		tx: postgres.TransactionSql,
		patientId: string,
		identifier: PatientIdentifier,
		source: RegistryRecordSource,
	): Promise<void> {
		await tx`
			INSERT INTO patient_identifier (id, patient_id, system, value, issuer, source)
			VALUES (${randomUUID()}, ${patientId}, ${identifier.system}, ${identifier.value}, ${identifier.issuer ?? null}, ${source})
		`
	}

	private async setIdentifierValidity(
		tx: postgres.TransactionSql,
		identifier: PatientIdentifier,
		validUntil: Date | null,
	): Promise<void> {
		await tx`
			UPDATE patient_identifier SET valid_until = ${validUntil}
			WHERE system = ${identifier.system}
				AND value = ${identifier.value}
				AND issuer IS NOT DISTINCT FROM ${identifier.issuer ?? null}::text
		`
	}
}
