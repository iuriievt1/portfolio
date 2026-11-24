import {
	type ClinicalEncounter,
	type ClinicalEncounterRecord,
	type ClinicalPatient,
	type CustomerIdentifier,
	ENCOUNTER_STATUS,
	type EncounterResourceIds,
	type EncounterStatus,
} from "@ansora/vulna-domain/ports"
import { conditionalUpdateAt, idOfEntry, urnOf } from "./bundle-entries"
import { studyInstanceUidIdentifierOf } from "./dicom-identifiers"
import type {
	Bundle,
	Coding,
	Device,
	Encounter,
	HumanName,
	Identifier,
	Organization,
	Patient,
	Reference,
} from "./fhir-types"
import { customerIdentifierSystemOf, type IdentifierSystems, serverDeviceValueOf, tokenOf } from "./identifiers"
import { PROVENANCE_ROLE, type ProvenanceStatement, provenanceEntryOf } from "./provenance-resources"
import { departmentTagOf } from "./resource-meta"

export interface EncounterContext {
	systems: IdentifierSystems
	instanceBase: string
	serviceProvider: Reference<Organization>
	device: Reference<Device>
}

// ADR-050 bod 3, CAP-014-R17
const ENCOUNTER_FHIR_STATUS: Record<EncounterStatus, NonNullable<Encounter["status"]>> = {
	[ENCOUNTER_STATUS.PLANNED]: "planned",
	[ENCOUNTER_STATUS.IN_PROGRESS]: "in-progress",
	[ENCOUNTER_STATUS.COMPLETED]: "finished",
	[ENCOUNTER_STATUS.CANCELLED]: "cancelled",
}

// ADR-050 bod 3
const DATA_ABSENT_REASON = "http://terminology.hl7.org/CodeSystem/data-absent-reason"
const ENCOUNTER_CLASS_ABSENT: Coding = { system: DATA_ABSENT_REASON, code: "unknown" }
const SERVER_DEVICE_NAME = "Ansora Vulna Server"

// ADR-050 bod 9, CAP-024-R07
function customerIdentifierOf(identifier: CustomerIdentifier, instanceBase: string): Identifier {
	const view: Identifier = {
		system: customerIdentifierSystemOf(instanceBase, identifier.issuer),
		value: identifier.value,
	}
	if (identifier.issuer !== undefined) {
		view.assigner = { display: identifier.issuer }
	}
	if (identifier.validUntil !== undefined) {
		view.use = "old"
		view.period = { end: identifier.validUntil }
	}
	return view
}

// CHG-175, NAB-479
function humanNameOf(patient: ClinicalPatient): HumanName | undefined {
	if (patient.familyName === undefined && patient.givenName === undefined) {
		return undefined
	}
	return {
		...(patient.familyName === undefined ? {} : { family: patient.familyName }),
		...(patient.givenName === undefined ? {} : { given: [patient.givenName] }),
	}
}

// ADR-050 bod 3, ADR-050 bod 9, NAB-479, CHG-175
function patientOf(patient: ClinicalPatient, context: EncounterContext): Patient {
	const resource: Patient = {
		resourceType: "Patient",
		identifier: [
			{ system: context.systems.patient, value: patient.patientId },
			...patient.identifiers.map((identifier) => customerIdentifierOf(identifier, context.instanceBase)),
		],
		active: true,
	}
	const name = humanNameOf(patient)
	if (name !== undefined) {
		resource.name = [name]
	}
	if (patient.birthDate !== undefined) {
		resource.birthDate = patient.birthDate
	}
	if (patient.sex !== undefined) {
		resource.gender = patient.sex
	}
	return resource
}

// ADR-050 bod 3, ADR-050 bod 8, CAP-014-R17, datovy-model.md 13.3
function encounterOf(encounter: ClinicalEncounter, subject: Reference<Patient>, context: EncounterContext): Encounter {
	return {
		resourceType: "Encounter",
		meta: { tag: departmentTagOf(encounter.department, context.systems) },
		identifier: [
			{ system: context.systems.encounter, value: encounter.encounterId },
			studyInstanceUidIdentifierOf(encounter.studyInstanceUid),
		],
		status: ENCOUNTER_FHIR_STATUS[encounter.status],
		class: ENCOUNTER_CLASS_ABSENT,
		subject,
		serviceProvider: context.serviceProvider,
	}
}

// ADR-050 bod 10
export function serverDeviceOf(instanceCode: string, serverVersion: string, systems: IdentifierSystems): Device {
	return {
		resourceType: "Device",
		identifier: [{ system: systems.device, value: serverDeviceValueOf(instanceCode, serverVersion) }],
		status: "active",
		deviceName: [{ name: SERVER_DEVICE_NAME, type: "manufacturer-name" }],
		version: [{ value: serverVersion }],
	}
}

function encounterProvenanceKeyOf(encounter: ClinicalEncounter): string {
	return `encounter:${encounter.encounterId}:${encounter.status}:${encounter.statusChangedAt}`
}

function patientProvenanceKeyOf(patient: ClinicalPatient): string {
	return `patient:${patient.patientId}:${patient.demographicsRevision}`
}

// ADR-050 bod 9, ADR-050 bod 10, CAP-014-R17
function statementOf(
	record: ClinicalEncounterRecord,
	context: EncounterContext,
	target: string,
	key: string,
): ProvenanceStatement {
	return {
		key,
		patientId: record.patient.patientId,
		targets: [target],
		recorded: record.encounter.statusChangedAt,
		occurred: undefined,
		agents: [{ role: PROVENANCE_ROLE.AUTHOR, who: context.device }],
	}
}

// ADR-050 bod 10
export function encounterBundleOf(record: ClinicalEncounterRecord, context: EncounterContext): Bundle {
	const patientUrn = urnOf(record.patient.patientId)
	const encounterUrn = urnOf(record.encounter.encounterId)
	const encounter = encounterOf(record.encounter, { reference: patientUrn }, context)
	return {
		resourceType: "Bundle",
		type: "transaction",
		entry: [
			conditionalUpdateAt(
				patientUrn,
				patientOf(record.patient, context),
				tokenOf(context.systems.patient, record.patient.patientId),
			),
			conditionalUpdateAt(encounterUrn, encounter, tokenOf(context.systems.encounter, record.encounter.encounterId)),
			provenanceEntryOf(
				statementOf(record, context, patientUrn, patientProvenanceKeyOf(record.patient)),
				context.systems,
			),
			provenanceEntryOf(
				statementOf(record, context, encounterUrn, encounterProvenanceKeyOf(record.encounter)),
				context.systems,
			),
		],
	}
}

// ADR-050 bod 10
export function resourceIdsOf(result: Bundle): EncounterResourceIds {
	const [patient, encounter, ...provenance] = result.entry ?? []
	for (const entry of provenance) {
		idOfEntry(entry, "provenance")
	}
	return { patient: idOfEntry(patient, "patient"), encounter: idOfEntry(encounter, "encounter") }
}
