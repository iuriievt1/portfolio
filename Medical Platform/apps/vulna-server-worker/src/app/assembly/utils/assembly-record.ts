import type { CustomerIdentifier } from "@ansora/vulna-domain"
import type {
	AssemblyImage,
	AssemblyImageRow,
	AssemblyRecordRow,
	FoundRecord,
	PatientIdentifierRow,
} from "../types/assembly.types"

// ADR-004 ř. 22, CAP-024-R07
function customerIdentifierOf(row: PatientIdentifierRow): CustomerIdentifier {
	return {
		system: row.system,
		value: row.value,
		issuer: row.issuer ?? undefined,
		validUntil: row.valid_until?.toISOString(),
	}
}

// integrace-dicom.md 2, 5, datovy-model.md 3, 4 „Pořízení“
export function foundRecordOf(row: AssemblyRecordRow, identifiers: readonly PatientIdentifierRow[]): FoundRecord {
	return {
		acquisitionId: row.id,
		kind: row.kind,
		startedAt: row.started_at,
		fileCount: row.file_count ?? undefined,
		firstInstanceNumber: row.first_instance_number ?? undefined,
		findingId: row.finding_id ?? undefined,
		woundNumber: row.wound_number ?? undefined,
		documentId: row.document_id ?? undefined,
		operator: { familyName: row.operator_family_name, givenName: row.operator_given_name },
		closingHardwareId: row.closing_hardware_id ?? undefined,
		encounter: {
			studyInstanceUid: row.study_instance_uid,
			studyId: row.study_id,
			accessionNumber: row.accession_number ?? undefined,
			date: row.encounter_date,
			startedAt: row.encounter_started_at ?? undefined,
		},
		series:
			row.series_instance_uid === null || row.series_number === null
				? undefined
				: { seriesInstanceUid: row.series_instance_uid, number: row.series_number },
		patient: {
			familyName: row.family_name ?? undefined,
			givenName: row.given_name ?? undefined,
			birthDate: row.birth_date ?? undefined,
			sex: row.sex ?? undefined,
			identifiers: identifiers.map(customerIdentifierOf),
		},
		patientResourceId: row.patient_resource_id ?? undefined,
		delivery:
			row.delivery_id === null || row.delivery_state === null
				? undefined
				: { id: row.delivery_id, state: row.delivery_state },
	}
}

export function assemblyImageOf(row: AssemblyImageRow): AssemblyImage {
	return {
		imageId: row.id,
		sequence: row.sequence,
		binaryObjectId: row.binary_object_id,
		editKind: row.edit_kind ?? undefined,
	}
}
