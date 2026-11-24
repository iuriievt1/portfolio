import type { ClosedSeries, StoredScanRecord, StoredStudy, StoredWoundRecord } from "@ansora/vulna-domain/ports"
import { studyInstanceUidOf } from "./dicom-identifiers"
import { FINAL_DOCUMENT } from "./document-resources"
import { FINDING_RECORD, PATIENT_REFERENCE } from "./draft-records"
import type {
	BodyStructure,
	Condition,
	DocumentReference,
	ImagingStudy,
	ImagingStudySeries,
	Observation,
	Reference,
} from "./fhir-types"
import { IMAGING_STUDY_REFERENCE } from "./file-resources"
import {
	acquisitionFilterOf,
	assessmentQueryOf,
	closedQueryOf,
	closedWoundsOf,
	documentTitleOf,
	identifierValueOf,
	isDraft,
	present,
	referencedIdOf,
	type SearchQuery,
	withFindings,
} from "./history-resources"
import { OBSERVATION_STATUS } from "./observation-resources"
import type { ProjectionContext } from "./resource-meta"
import { STUDY_STATUS } from "./study-resources"

// ADR-054 bod 4, integrace-dicom.md 2
interface StoredWoundResources {
	assessment: Observation
	conditions: readonly Condition[]
	bodyStructures: readonly BodyStructure[]
	study: ImagingStudy | undefined
}

// ADR-054 bod 4, datovy-model.md 13.1 vulna-healing-phase
export function closedAssessmentQueryOf(context: ProjectionContext, acquisitionId: string): SearchQuery {
	return {
		...withFindings(assessmentQueryOf(context, acquisitionFilterOf(context, acquisitionId))),
		status: OBSERVATION_STATUS[FINDING_RECORD.CLOSED],
	}
}

// ADR-054 bod 4, ADR-052 bod 5
export function closedResourceQueryOf(context: ProjectionContext, resourceId: string): SearchQuery {
	return { ...closedQueryOf(context), _id: resourceId }
}

function studyIdIn(references: readonly Reference[] | undefined): string | undefined {
	return references?.map((reference) => referencedIdOf(reference, IMAGING_STUDY_REFERENCE)).find(present)
}

// ADR-050, integrace-dicom.md 5.9
export function studyIdOfAssessment(assessment: Observation): string | undefined {
	return studyIdIn(assessment.partOf)
}

// ADR-050, CAP-021-R39
export function studyIdOfDocument(document: DocumentReference): string | undefined {
	return studyIdIn(document.context?.related)
}

function seriesOf(series: ImagingStudySeries): ClosedSeries | undefined {
	return series.number === undefined ? undefined : { seriesInstanceUid: series.uid, number: series.number }
}

// datovy-model.md 3, 13.1, integrace-dicom.md 5.2, 5.3, 5.9
function storedStudyOf(study: ImagingStudy | undefined, context: ProjectionContext): StoredStudy | undefined {
	if (study === undefined || study.status === STUDY_STATUS.ENTERED_IN_ERROR || isDraft(study, context)) {
		return undefined
	}
	const patientResourceId = referencedIdOf(study.subject, PATIENT_REFERENCE)
	const studyInstanceUid = studyInstanceUidOf(study.identifier)
	if (patientResourceId === undefined || studyInstanceUid === undefined) {
		return undefined
	}
	return { patientResourceId, studyInstanceUid, series: (study.series ?? []).map(seriesOf).filter(present) }
}

// ADR-054 bod 4, ADR-050 bod 4, CAP-020-R21, CAP-021-R14, CAP-021-R15
export function storedWoundRecordOf(
	acquisitionId: string,
	resources: StoredWoundResources,
	context: ProjectionContext,
): StoredWoundRecord | undefined {
	const { assessment } = resources
	const closedStructures = resources.bodyStructures.filter((structure) => !isDraft(structure, context))
	const woundResources = {
		observations: [assessment],
		conditions: resources.conditions,
		bodyStructures: closedStructures,
	}
	const [wound] = closedWoundsOf(woundResources, context).wounds
	const patientResourceId = referencedIdOf(assessment.subject, PATIENT_REFERENCE)
	const study = storedStudyOf(resources.study, context)
	if (
		isDraft(assessment, context) ||
		wound?.findingId === undefined ||
		wound.site === undefined ||
		patientResourceId === undefined ||
		study === undefined
	) {
		return undefined
	}
	return {
		acquisitionId,
		patientResourceId,
		study,
		findingId: wound.findingId,
		site: wound.site,
		healingPhaseCode: wound.healingPhaseCode,
		closedWoundTypeCode: wound.closedWoundTypeCode,
		description: wound.description,
	}
}

// ADR-054 bod 4, CAP-021-R39, CAP-018-R15
export function storedScanRecordOf(
	acquisitionId: string,
	document: DocumentReference,
	study: ImagingStudy | undefined,
	context: ProjectionContext,
): StoredScanRecord | undefined {
	const documentId = identifierValueOf(document.identifier, context.systems.document)
	const patientResourceId = referencedIdOf(document.subject, PATIENT_REFERENCE)
	const storedStudy = storedStudyOf(study, context)
	if (
		document.docStatus !== FINAL_DOCUMENT ||
		isDraft(document, context) ||
		documentId === undefined ||
		patientResourceId === undefined ||
		storedStudy === undefined
	) {
		return undefined
	}
	return {
		acquisitionId,
		patientResourceId,
		study: storedStudy,
		documentId,
		title: documentTitleOf(document, context),
	}
}
