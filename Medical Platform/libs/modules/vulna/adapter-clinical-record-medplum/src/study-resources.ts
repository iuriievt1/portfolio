import type { ClinicalStudy } from "@ansora/vulna-domain/ports"
import { studyInstanceUidIdentifierOf } from "./dicom-identifiers"
import { PATIENT_REFERENCE } from "./draft-records"
import type { Coding, ImagingStudy, ImagingStudySeries, Meta } from "./fhir-types"
import type { IdentifierSystems } from "./identifiers"

export const ENCOUNTER_REFERENCE = "Encounter/"

// ADR-050, ADR-050 (doplnění D33) body 1 a 3
export const STUDY_STATUS = {
	REGISTERED: "registered",
	AVAILABLE: "available",
	ENTERED_IN_ERROR: "entered-in-error",
} as const

// ADR-050, datovy-model.md 13.1, integrace-dicom.md 5.9
export interface StudyContent {
	existing: ImagingStudy | undefined
	study: ClinicalStudy
	patientResourceId: string
	meta: Meta
	status: ImagingStudy["status"]
	series: ImagingStudySeries[]
}

export function modalitiesOf(series: readonly ImagingStudySeries[]): Coding[] {
	const byCode = new Map<string | undefined, Coding>()
	for (const item of series) {
		if (!byCode.has(item.modality.code)) {
			byCode.set(item.modality.code, { ...item.modality })
		}
	}
	return [...byCode.values()]
}

// datovy-model.md 3, ADR-050
export function seriesWith(
	existing: readonly ImagingStudySeries[] | undefined,
	own: ImagingStudySeries,
): ImagingStudySeries[] {
	return [...(existing ?? []).filter((candidate) => candidate.uid !== own.uid), own].sort(
		(left, right) => (left.number ?? 0) - (right.number ?? 0),
	)
}

// CAP-021-R28, datovy-model.md 13.1
export function withCountsOf(study: ImagingStudy): ImagingStudy {
	const { numberOfSeries: _series, numberOfInstances: _instances, ...uncounted } = study
	const delivered = (study.series ?? []).filter((series) => (series.instance?.length ?? 0) > 0)
	if (delivered.length === 0) {
		return uncounted
	}
	return {
		...uncounted,
		numberOfSeries: delivered.length,
		numberOfInstances: delivered.reduce((count, series) => count + (series.instance?.length ?? 0), 0),
	}
}

// ADR-050, datovy-model.md 13.1, integrace-dicom.md 5.9
export function studyResourceOf(content: StudyContent, systems: IdentifierSystems): ImagingStudy {
	const { study, series } = content
	const resource: ImagingStudy = {
		...content.existing,
		resourceType: "ImagingStudy",
		meta: content.meta,
		identifier: [
			{ system: systems.imagingStudy, value: study.encounterId },
			studyInstanceUidIdentifierOf(study.studyInstanceUid),
		],
		status: content.status,
		modality: modalitiesOf(series),
		subject: { reference: `${PATIENT_REFERENCE}${content.patientResourceId}` },
		encounter: { reference: `${ENCOUNTER_REFERENCE}${study.encounterResourceId}` },
		series,
	}
	if (study.started !== undefined) {
		resource.started = study.started
	}
	return withCountsOf(resource)
}
