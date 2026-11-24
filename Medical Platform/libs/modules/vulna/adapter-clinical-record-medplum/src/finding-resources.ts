import {
	type ClinicalDraftFinding,
	type ClinicalDraftWoundType,
	type FindingResourceIds,
	findingSiteKeyOf,
} from "@ansora/vulna-domain/ports"
import { conditionalUpdate, idOfEntry } from "./bundle-entries"
import { FINDING_RECORD, type FindingRecord, PATIENT_REFERENCE, userSelected } from "./draft-records"
import type { BodyStructure, Bundle, Condition, Extension } from "./fhir-types"
import { tokenOf } from "./identifiers"
import { woundTypeObservationOf } from "./observation-resources"
import { clinicalMetaOf, type ProjectionContext } from "./resource-meta"
import { LATERALITY_SNOMED, SNOMED_CT } from "./snomed-codes"

// ADR-050 bod 1
export const INCLUDED_STRUCTURE =
	"http://hl7.org/fhir/5.0/StructureDefinition/extension-BodyStructure.includedStructure"
// ADR-050 bod 4, ADR-050 (doplnění D33) bod 1
const CONDITION_VERIFICATION = "http://terminology.hl7.org/CodeSystem/condition-ver-status"
const WOUND = "wound"
const WOUND_DOCUMENTATION = "wound-documentation"

export const STRUCTURE_PART = {
	STRUCTURE: "structure",
	LATERALITY: "laterality",
	QUALIFIER: "qualifier",
} as const

export const POSITION_PART = {
	VIEW: "view",
	X: "coordinateX",
	Y: "coordinateY",
	VERSION: "diagramVersion",
} as const

// ADR-050
const VERIFICATION: Record<FindingRecord, string | undefined> = {
	[FINDING_RECORD.DRAFT]: "unconfirmed",
	[FINDING_RECORD.CLOSED]: undefined,
	[FINDING_RECORD.WITHDRAWN]: "entered-in-error",
}

// ADR-050 bod 4, CAP-020-R13
export function conditionOf(
	finding: ClinicalDraftFinding,
	record: FindingRecord,
	context: ProjectionContext,
): Condition {
	const { systems } = context
	const condition: Condition = {
		resourceType: "Condition",
		meta: clinicalMetaOf(systems.woundFindingProfile, finding, record, context),
		identifier: [{ system: systems.finding, value: finding.findingId }],
		category: [{ coding: [{ system: systems.conditionCategory, code: WOUND_DOCUMENTATION }] }],
		code: { coding: [{ system: systems.findingKind, code: WOUND }] },
		subject: { reference: `${PATIENT_REFERENCE}${finding.patientResourceId}` },
	}
	const verification = VERIFICATION[record]
	if (verification !== undefined) {
		condition.verificationStatus = { coding: [{ system: CONDITION_VERIFICATION, code: verification }] }
	}
	return condition
}

// ADR-050 bod 4, ADR-050 (doplnění D33) body 1 až 4, CAP-016-R03, CAP-016-R04, CAP-016-R16, CAP-016-R20
export function bodyStructureOf(
	finding: ClinicalDraftFinding,
	record: FindingRecord,
	context: ProjectionContext,
): BodyStructure {
	const { systems } = context
	const site = finding.site
	const laterality: Extension[] =
		site.laterality === null
			? []
			: [
					{
						url: STRUCTURE_PART.LATERALITY,
						valueCodeableConcept: userSelected(SNOMED_CT, LATERALITY_SNOMED[site.laterality]),
					},
				]
	return {
		resourceType: "BodyStructure",
		meta: clinicalMetaOf(systems.woundSiteProfile, finding, record, context),
		identifier: [{ system: systems.findingSite, value: findingSiteKeyOf(finding.findingId, site.bodyDiagramVersion) }],
		active: record !== FINDING_RECORD.WITHDRAWN,
		patient: { reference: `${PATIENT_REFERENCE}${finding.patientResourceId}` },
		extension: [
			{
				url: INCLUDED_STRUCTURE,
				extension: [
					{ url: STRUCTURE_PART.STRUCTURE, valueCodeableConcept: userSelected(SNOMED_CT, site.regionCode) },
					...laterality,
					{ url: STRUCTURE_PART.QUALIFIER, valueCodeableConcept: userSelected(systems.bodySurface, site.surface) },
				],
			},
			{
				url: systems.bodyDiagramPosition,
				extension: [
					{ url: POSITION_PART.VIEW, valueCode: site.view },
					{ url: POSITION_PART.X, valueDecimal: site.x },
					{ url: POSITION_PART.Y, valueDecimal: site.y },
					{ url: POSITION_PART.VERSION, valueString: site.bodyDiagramVersion },
				],
			},
		],
	}
}

// ADR-050 bod 10, ADR-054 bod 3
export function findingBundleOf(
	finding: ClinicalDraftFinding,
	record: FindingRecord,
	context: ProjectionContext,
): Bundle {
	const { systems } = context
	const siteKey = findingSiteKeyOf(finding.findingId, finding.site.bodyDiagramVersion)
	return {
		resourceType: "Bundle",
		type: "transaction",
		entry: [
			conditionalUpdate(conditionOf(finding, record, context), tokenOf(systems.finding, finding.findingId)),
			conditionalUpdate(bodyStructureOf(finding, record, context), tokenOf(systems.findingSite, siteKey)),
		],
	}
}

// ADR-050 bod 10, ADR-050 (doplnění D33) bod 3, ADR-052 bod 6
export function withdrawnFindingBundleOf(
	finding: ClinicalDraftFinding,
	woundType: ClinicalDraftWoundType | undefined,
	context: ProjectionContext,
): Bundle {
	const bundle = findingBundleOf(finding, FINDING_RECORD.WITHDRAWN, context)
	if (woundType === undefined) {
		return bundle
	}
	const observation = woundTypeObservationOf(woundType, FINDING_RECORD.WITHDRAWN, context)
	const identifier = tokenOf(context.systems.findingWoundType, woundType.findingId)
	return { ...bundle, entry: [...(bundle.entry ?? []), conditionalUpdate(observation, identifier)] }
}

export function findingResourceIdsOf(result: Bundle): FindingResourceIds {
	const [condition, bodyStructure] = result.entry ?? []
	return { condition: idOfEntry(condition, "condition"), bodyStructure: idOfEntry(bodyStructure, "body structure") }
}
