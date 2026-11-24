import {
	BODY_VIEWS,
	type BodyView,
	type ClinicalDocumentTitle,
	CODE_LIST,
	type HistoryFinding,
	type HistoryRecords,
	type HistoryScanRecord,
	type HistoryWoundRecord,
	type HistoryWounds,
	type Laterality,
} from "@ansora/vulna-domain/ports"
import { ATTACHMENT_PAGES, CURRENT_DOCUMENT } from "./document-resources"
import { FINDING_RECORD, PATIENT_REFERENCE } from "./draft-records"
import type {
	BodyStructure,
	CodeableConcept,
	Condition,
	DocumentReference,
	Extension,
	Identifier,
	Observation,
	Reference,
	Resource,
} from "./fhir-types"
import { IMAGING_STUDY_REFERENCE } from "./file-resources"
import { INCLUDED_STRUCTURE, POSITION_PART, STRUCTURE_PART } from "./finding-resources"
import { codeSystemUrlOf, tokenOf } from "./identifiers"
import {
	BODY_SITE_EXTENSION,
	BODY_STRUCTURE_REFERENCE,
	CONDITION_REFERENCE,
	HEALING_PHASE_LOINC,
	LOINC,
	OBSERVATION_STATUS,
	WOUND_TYPE_LOINC,
} from "./observation-resources"
import type { ProjectionContext } from "./resource-meta"
import { LATERALITY_SNOMED, SNOMED_CT } from "./snomed-codes"
import { ENCOUNTER_REFERENCE } from "./study-resources"

type RecordSite = NonNullable<HistoryWoundRecord["site"]>
export type SearchQuery = Record<string, string>

const VALUE_SEPARATOR = ","
const FOCUS_INCLUDE = "Observation:focus"
// backend.md 3.1, ADR-050 bod 11
export const PAGE_QUERY: SearchQuery = { _count: "200", _total: "none" }

export const NO_RECORDS: HistoryRecords = { findings: [], wounds: [], scans: [] }

const SNOMED_LATERALITY: ReadonlyMap<string, Laterality> = new Map(
	Object.entries(LATERALITY_SNOMED).map(([laterality, code]) => [code, laterality as Laterality]),
)

// ADR-050 bod 8, ADR-052 bod 5, ADR-053 bod 3
export function closedQueryOf(context: ProjectionContext): SearchQuery {
	return { "_tag:not": `${context.systems.draftTag}|` }
}

// datovy-model.md 13.1 vulna-healing-phase, vulna-wound-type
function observationQueryOf(context: ProjectionContext, filter: SearchQuery, codes: readonly string[]): SearchQuery {
	return {
		...filter,
		...closedQueryOf(context),
		code: codes.map((code) => tokenOf(LOINC, code)).join(VALUE_SEPARATOR),
		"status:not": OBSERVATION_STATUS[FINDING_RECORD.WITHDRAWN],
	}
}

// CAP-020-R01, CAP-016-R17, CAP-020-R19
export function clinicalObservationQueryOf(context: ProjectionContext, filter: SearchQuery): SearchQuery {
	return withFindings(observationQueryOf(context, filter, [HEALING_PHASE_LOINC, WOUND_TYPE_LOINC]))
}

// CAP-014-R19, CAP-014-R22, CAP-020-R17
export function assessmentQueryOf(context: ProjectionContext, filter: SearchQuery): SearchQuery {
	return observationQueryOf(context, filter, [HEALING_PHASE_LOINC])
}

export function withFindings(query: SearchQuery): SearchQuery {
	return { ...query, _include: FOCUS_INCLUDE }
}

// datovy-model.md 13.1 vulna-scanned-document
export function scannedDocumentQueryOf(context: ProjectionContext, filter: SearchQuery): SearchQuery {
	return {
		...filter,
		...closedQueryOf(context),
		_profile: context.systems.scannedDocumentProfile,
		status: CURRENT_DOCUMENT,
	}
}

export function patientFilterOf(patientResourceId: string): SearchQuery {
	return { subject: `${PATIENT_REFERENCE}${patientResourceId}` }
}

export function findingFilterOf(conditionResourceId: string): SearchQuery {
	return { focus: `${CONDITION_REFERENCE}${conditionResourceId}` }
}

export function acquisitionFilterOf(context: ProjectionContext, acquisitionId: string): SearchQuery {
	return { identifier: tokenOf(context.systems.acquisition, acquisitionId) }
}

export function studyFilterOf(imagingStudyResourceIds: readonly string[]): SearchQuery {
	return { "part-of": imagingStudyResourceIds.map((id) => `${IMAGING_STUDY_REFERENCE}${id}`).join(VALUE_SEPARATOR) }
}

export function encounterFilterOf(encounterResourceIds: readonly string[]): SearchQuery {
	return { encounter: encounterResourceIds.map((id) => `${ENCOUNTER_REFERENCE}${id}`).join(VALUE_SEPARATOR) }
}

export function bodyStructureQueryOf(bodyStructureIds: readonly string[]): SearchQuery {
	return { _id: bodyStructureIds.join(VALUE_SEPARATOR) }
}

export function identifierValueOf(identifiers: readonly Identifier[] | undefined, system: string): string | undefined {
	return identifiers?.find((identifier) => identifier.system === system)?.value
}

function codeOf(concept: CodeableConcept | undefined, system: string): string | undefined {
	return concept?.coding?.find((coding) => coding.system === system)?.code
}

export function referencedIdOf(reference: Reference | undefined, prefix: string): string | undefined {
	const value = reference?.reference
	return value?.startsWith(prefix) === true ? value.slice(prefix.length) : undefined
}

function extensionOf(extensions: readonly Extension[] | undefined, url: string): Extension | undefined {
	return extensions?.find((extension) => extension.url === url)
}

function isLoinc(concept: CodeableConcept | undefined, code: string): boolean {
	return codeOf(concept, LOINC) === code
}

function isBodyView(value: string | undefined): value is BodyView {
	return BODY_VIEWS.some((view) => view === value)
}

// ADR-050 bod 4, CAP-016-R03, CAP-016-R16, CAP-016-R20
export function bodySiteOf(structure: BodyStructure, context: ProjectionContext): RecordSite | undefined {
	const included = extensionOf(structure.extension, INCLUDED_STRUCTURE)?.extension
	const position = extensionOf(structure.extension, context.systems.bodyDiagramPosition)?.extension
	const regionCode = codeOf(extensionOf(included, STRUCTURE_PART.STRUCTURE)?.valueCodeableConcept, SNOMED_CT)
	const lateralityCode = codeOf(extensionOf(included, STRUCTURE_PART.LATERALITY)?.valueCodeableConcept, SNOMED_CT)
	const view = extensionOf(position, POSITION_PART.VIEW)?.valueCode
	const x = extensionOf(position, POSITION_PART.X)?.valueDecimal
	const y = extensionOf(position, POSITION_PART.Y)?.valueDecimal
	const bodyDiagramVersion = extensionOf(position, POSITION_PART.VERSION)?.valueString
	const laterality = lateralityCode === undefined ? null : SNOMED_LATERALITY.get(lateralityCode)
	if (
		regionCode === undefined ||
		laterality === undefined ||
		!isBodyView(view) ||
		x === undefined ||
		y === undefined ||
		bodyDiagramVersion === undefined
	) {
		return undefined
	}
	return { regionCode, laterality, view, x, y, bodyDiagramVersion }
}

// ADR-050 bod 4
export function bodyStructureIdOf(assessment: Observation): string | undefined {
	return referencedIdOf(
		extensionOf(assessment.bodySite?.extension, BODY_SITE_EXTENSION)?.valueReference,
		BODY_STRUCTURE_REFERENCE,
	)
}

function conditionIdOf(observation: Observation): string | undefined {
	return referencedIdOf(observation.focus?.[0], CONDITION_REFERENCE)
}

export function isAssessment(observation: Observation): boolean {
	return isLoinc(observation.code, HEALING_PHASE_LOINC)
}

function isWoundType(observation: Observation): boolean {
	return isLoinc(observation.code, WOUND_TYPE_LOINC)
}

export interface WoundResources {
	observations: readonly Observation[]
	conditions: readonly Condition[]
	bodyStructures: readonly BodyStructure[]
}

// ADR-052 bod 5
export function isDraft(resource: Resource, context: ProjectionContext): boolean {
	return resource.meta?.tag?.some((tag) => tag.system === context.systems.draftTag) === true
}

function findingIdsOf(conditions: readonly Condition[], context: ProjectionContext): ReadonlyMap<string, string> {
	const ids = new Map<string, string>()
	for (const condition of conditions.filter((candidate) => !isDraft(candidate, context))) {
		const findingId = identifierValueOf(condition.identifier, context.systems.finding)
		if (condition.id !== undefined && findingId !== undefined) {
			ids.set(condition.id, findingId)
		}
	}
	return ids
}

// CAP-020-R19, ADR-050 bod 4
function closedFindingsOf(
	resources: WoundResources,
	findingIds: ReadonlyMap<string, string>,
	context: ProjectionContext,
): HistoryFinding[] {
	const woundTypeSystem = codeSystemUrlOf(context.instanceBase, CODE_LIST.WOUND_TYPE)
	const woundTypes = new Map<string, string | undefined>()
	for (const observation of resources.observations.filter(isWoundType)) {
		const conditionId = conditionIdOf(observation)
		if (conditionId !== undefined) {
			woundTypes.set(conditionId, codeOf(observation.valueCodeableConcept, woundTypeSystem))
		}
	}
	return [...findingIds].map(([conditionId, findingId]) => ({
		findingId,
		woundTypeCode: woundTypes.get(conditionId),
	}))
}

// CAP-020-R17, CAP-020-R21, ADR-050 bod 4
function woundRecordOf(
	assessment: Observation,
	findingIds: ReadonlyMap<string, string>,
	sites: ReadonlyMap<string, RecordSite>,
	context: ProjectionContext,
): HistoryWoundRecord | undefined {
	const acquisitionId = identifierValueOf(assessment.identifier, context.systems.acquisition)
	if (acquisitionId === undefined) {
		return undefined
	}
	const conditionId = conditionIdOf(assessment)
	const bodyStructureId = bodyStructureIdOf(assessment)
	const closedWoundType = assessment.component?.find((component) => isLoinc(component.code, WOUND_TYPE_LOINC))
	return {
		acquisitionId,
		findingId: conditionId === undefined ? undefined : findingIds.get(conditionId),
		site: bodyStructureId === undefined ? undefined : sites.get(bodyStructureId),
		healingPhaseCode: codeOf(
			assessment.valueCodeableConcept,
			codeSystemUrlOf(context.instanceBase, CODE_LIST.HEALING_PHASE),
		),
		description: assessment.note?.[0]?.text,
		closedWoundTypeCode: codeOf(
			closedWoundType?.valueCodeableConcept,
			codeSystemUrlOf(context.instanceBase, CODE_LIST.WOUND_TYPE),
		),
	}
}

// CAP-018-R15, CAP-021-R39
export function documentTitleOf(document: DocumentReference, context: ProjectionContext): ClinicalDocumentTitle {
	return {
		code: codeOf(document.type, codeSystemUrlOf(context.instanceBase, CODE_LIST.DOCUMENT_TITLE)),
		text: document.type?.text,
	}
}

// CAP-020-R18, CAP-018-R15, CAP-021-R39
function scanRecordOf(document: DocumentReference, context: ProjectionContext): HistoryScanRecord | undefined {
	const acquisitionId = identifierValueOf(document.identifier, context.systems.acquisition)
	const documentId = identifierValueOf(document.identifier, context.systems.document)
	const pageCount = extensionOf(document.content?.[0]?.attachment.extension, ATTACHMENT_PAGES)?.valuePositiveInt
	if (
		acquisitionId === undefined ||
		documentId === undefined ||
		document.date === undefined ||
		pageCount === undefined
	) {
		return undefined
	}
	return {
		acquisitionId,
		documentId,
		closedAt: document.date,
		title: documentTitleOf(document, context),
		pageCount,
	}
}

function sitesOf(structures: readonly BodyStructure[], context: ProjectionContext): ReadonlyMap<string, RecordSite> {
	const sites = new Map<string, RecordSite>()
	for (const structure of structures) {
		const site = bodySiteOf(structure, context)
		if (structure.id !== undefined && site !== undefined) {
			sites.set(structure.id, site)
		}
	}
	return sites
}

export function present<T>(value: T | undefined): value is T {
	return value !== undefined
}

// ADR-054 bod 2, CAP-020-R03
export function closedWoundsOf(resources: WoundResources, context: ProjectionContext): HistoryWounds {
	const findingIds = findingIdsOf(resources.conditions, context)
	const sites = sitesOf(resources.bodyStructures, context)
	return {
		findings: closedFindingsOf(resources, findingIds, context),
		wounds: resources.observations
			.filter(isAssessment)
			.map((assessment) => woundRecordOf(assessment, findingIds, sites, context))
			.filter(present),
	}
}

// CAP-020-R18, CAP-021-R39
export function closedScansOf(
	documents: readonly DocumentReference[],
	context: ProjectionContext,
): HistoryScanRecord[] {
	return documents.map((document) => scanRecordOf(document, context)).filter(present)
}

// CAP-014-R19, CAP-014-R22
export function acquisitionIdsOf(
	observations: readonly Observation[],
	documents: readonly DocumentReference[],
	context: ProjectionContext,
): string[] {
	return [...observations.filter(isAssessment), ...documents]
		.map((resource) => identifierValueOf(resource.identifier, context.systems.acquisition))
		.filter(present)
}
