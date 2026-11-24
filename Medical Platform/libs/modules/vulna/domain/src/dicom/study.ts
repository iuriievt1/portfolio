import { INSTANCE_TIME_ZONE } from "../registry/day-interval"
import { dicomDateOf, dicomMomentIn } from "./date-time"
import { uidOf } from "./uid"
import { EMPTY_VALUE, SHORT_STRING_MAX_LENGTH, stringValueOf } from "./value-representation"

// integrace-dicom.md 5.2
export interface DicomStudy {
	studyInstanceUid: string
	studyId: string
	accessionNumber: string
	studyDate: string
	studyTime: string
	referringPhysicianName: string
}

export interface StudyEncounter {
	studyInstanceUid: string
	studyId: string
	accessionNumber: string | undefined
	// CAP-014-R03, CAP-014-R06
	date: string
	startedAt: Date | undefined
}

// integrace-dicom.md 4, 5.2, NAB-369, CAP-014-R05, CAP-014-R10, CAP-014-S33
export function dicomStudyOf(encounter: StudyEncounter): DicomStudy {
	return {
		studyInstanceUid: uidOf("Study Instance UID", encounter.studyInstanceUid),
		studyId: stringValueOf("Study ID", encounter.studyId, SHORT_STRING_MAX_LENGTH),
		accessionNumber: stringValueOf(
			"Accession Number",
			encounter.accessionNumber ?? EMPTY_VALUE,
			SHORT_STRING_MAX_LENGTH,
		),
		studyDate: dicomDateOf("Study Date", encounter.date),
		studyTime:
			encounter.startedAt === undefined ? EMPTY_VALUE : dicomMomentIn(INSTANCE_TIME_ZONE, encounter.startedAt).time,
		referringPhysicianName: EMPTY_VALUE,
	}
}
