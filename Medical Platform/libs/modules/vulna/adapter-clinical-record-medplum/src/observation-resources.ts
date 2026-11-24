import {
	type ClinicalDraftAssessment,
	type ClinicalDraftWoundType,
	type ClinicalWoundTypeChange,
	CODE_LIST,
} from "@ansora/vulna-domain/ports"
import { FINDING_RECORD, type FindingRecord, PATIENT_REFERENCE, userSelected } from "./draft-records"
import type { CodeableConcept, Meta, Observation, Practitioner, PractitionerRole, Reference } from "./fhir-types"
import { codeSystemUrlOf } from "./identifiers"
import { clinicalMetaOf, closedMetaOf, type ProjectionContext } from "./resource-meta"

export const LOINC = "http://loinc.org"
// datovy-model.md 13.1, ADR-050 bod 3
export const WOUND_TYPE_LOINC = "72300-7"
export const HEALING_PHASE_LOINC = "96558-2"
const DATA_ABSENT_REASON = "http://terminology.hl7.org/CodeSystem/data-absent-reason"
const NOT_ASKED = "not-asked"
export const BODY_SITE_EXTENSION = "http://hl7.org/fhir/StructureDefinition/bodySite"
export const CONDITION_REFERENCE = "Condition/"
export const BODY_STRUCTURE_REFERENCE = "BodyStructure/"

// datovy-model.md 13.1
export function woundTypeConcept(): CodeableConcept {
	return { coding: [{ system: LOINC, code: WOUND_TYPE_LOINC }] }
}

// ADR-052, ADR-050
export const OBSERVATION_STATUS: Record<FindingRecord, Observation["status"]> = {
	[FINDING_RECORD.DRAFT]: "preliminary",
	[FINDING_RECORD.CLOSED]: "final",
	[FINDING_RECORD.WITHDRAWN]: "entered-in-error",
}

// ADR-049 (doplnění D32), datovy-model.md 13.1
const AMENDED_STATUS: Observation["status"] = "amended"

type WoundTypeValue = Pick<
	ClinicalDraftWoundType,
	"findingId" | "patientResourceId" | "conditionResourceId" | "woundTypeCode" | "woundTypeName"
>

// ADR-050 bod 4, datovy-model.md 13.1, CAP-021-R26
export function codeListValueOf(
	instanceBase: string,
	codeListCode: string,
	code: string,
	name: string | undefined,
): CodeableConcept {
	const value: CodeableConcept = userSelected(codeSystemUrlOf(instanceBase, codeListCode), code)
	if (name !== undefined) {
		value.text = name
	}
	return value
}

function woundTypeObservationWith(
	woundType: WoundTypeValue,
	meta: Meta,
	status: Observation["status"],
	context: ProjectionContext,
): Observation {
	return {
		resourceType: "Observation",
		meta,
		identifier: [{ system: context.systems.findingWoundType, value: woundType.findingId }],
		status,
		code: woundTypeConcept(),
		subject: { reference: `${PATIENT_REFERENCE}${woundType.patientResourceId}` },
		focus: [{ reference: `${CONDITION_REFERENCE}${woundType.conditionResourceId}` }],
		valueCodeableConcept: codeListValueOf(
			context.instanceBase,
			CODE_LIST.WOUND_TYPE,
			woundType.woundTypeCode,
			woundType.woundTypeName,
		),
	}
}

// ADR-050 bod 4, CAP-017-R02, CAP-020-R19, CAP-017-R20
export function woundTypeObservationOf(
	woundType: ClinicalDraftWoundType,
	record: FindingRecord,
	context: ProjectionContext,
): Observation {
	const meta = clinicalMetaOf(context.systems.woundTypeProfile, woundType, record, context)
	return woundTypeObservationWith(woundType, meta, OBSERVATION_STATUS[record], context)
}

// CAP-020-R21, ADR-049 (doplnění D32), ADR-050 bod 10
export function amendedWoundTypeObservationOf(
	change: ClinicalWoundTypeChange,
	author: Reference<Practitioner | PractitionerRole>,
	context: ProjectionContext,
): Observation {
	const meta = closedMetaOf(context.systems.woundTypeProfile, change.department, context)
	return {
		...woundTypeObservationWith(change, meta, AMENDED_STATUS, context),
		issued: change.changedAt,
		performer: [author],
	}
}

// ADR-050 bod 4, CAP-017-R03, CAP-017-R04, CAP-017-R20, datovy-model.md 13.1
export function assessmentObservationOf(
	assessment: ClinicalDraftAssessment,
	record: FindingRecord,
	context: ProjectionContext,
): Observation {
	const { systems } = context
	const observation: Observation = {
		resourceType: "Observation",
		meta: clinicalMetaOf(systems.healingPhaseProfile, assessment, record, context),
		identifier: [{ system: systems.acquisition, value: assessment.acquisitionId }],
		status: OBSERVATION_STATUS[record],
		code: { coding: [{ system: LOINC, code: HEALING_PHASE_LOINC }] },
		subject: { reference: `${PATIENT_REFERENCE}${assessment.patientResourceId}` },
		focus: [{ reference: `${CONDITION_REFERENCE}${assessment.conditionResourceId}` }],
		bodySite: {
			extension: [
				{
					url: BODY_SITE_EXTENSION,
					valueReference: { reference: `${BODY_STRUCTURE_REFERENCE}${assessment.bodyStructureResourceId}` },
				},
			],
		},
	}
	// CAP-017-R16, CHG-181
	if (assessment.healingPhaseCode === undefined) {
		observation.dataAbsentReason = { coding: [{ system: DATA_ABSENT_REASON, code: NOT_ASKED }] }
	} else {
		observation.valueCodeableConcept = codeListValueOf(
			context.instanceBase,
			CODE_LIST.HEALING_PHASE,
			assessment.healingPhaseCode,
			assessment.healingPhaseName,
		)
	}
	if (assessment.description !== undefined) {
		observation.note = [{ text: assessment.description }]
	}
	return observation
}
