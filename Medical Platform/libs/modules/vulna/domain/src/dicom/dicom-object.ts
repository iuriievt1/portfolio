import { type DicomEquipment, dicomEquipmentOf } from "./equipment"
import { type DicomInstance, type DicomInstanceSource, dicomInstanceOf } from "./instance"
import { type DicomPatient, type DicomPatientSource, dicomPatientOf } from "./patient"
import {
	type DicomOperator,
	type DicomSeries,
	type DicomSeriesSource,
	type DicomStation,
	dicomSeriesOf,
	type Modality,
} from "./series"
import type { SopClass } from "./sop-class"
import { type DicomStudy, dicomStudyOf, type StudyEncounter } from "./study"

// integrace-dicom.md 5, datovy-model.md 4
export interface DicomAssembly {
	builtAt: Date
	language: string
	softwareVersion: string
	patientIdSystem: string | undefined
}

// integrace-dicom.md 5, CAP-021-R13
export interface DicomCommonSource {
	assembly: DicomAssembly
	patient: DicomPatientSource
	encounter: StudyEncounter
	series: DicomSeriesSource
	operator: DicomOperator
	station: DicomStation
	instance: DicomInstanceSource
}

// integrace-dicom.md 5.1, 5.2, 5.3, 5.4, 5.7
export interface DicomCommonObject {
	patient: DicomPatient
	study: DicomStudy
	series: DicomSeries
	equipment: DicomEquipment
	instance: DicomInstance
}

// integrace-dicom.md 5, CAP-021-R13
export function dicomCommonOf(source: DicomCommonSource, modality: Modality, sopClass: SopClass): DicomCommonObject {
	const { assembly } = source
	return {
		patient: dicomPatientOf(source.patient, assembly.patientIdSystem),
		study: dicomStudyOf(source.encounter),
		series: dicomSeriesOf(source.series, modality, source.operator, source.station),
		equipment: dicomEquipmentOf(assembly.softwareVersion),
		instance: dicomInstanceOf(sopClass, source.instance, assembly.builtAt),
	}
}
