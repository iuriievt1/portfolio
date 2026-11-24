import { describe, expect, it } from "vitest"
import { DICOM_MAPPING_FAILURE } from "../dicom/mapping-error"
import { dicomStudyOf, type StudyEncounter } from "../dicom/study"

const FROM_WORKLIST: StudyEncounter = {
	studyInstanceUid: "1.2.840.113619.2.1",
	studyId: "2026-000041",
	accessionNumber: "ACC-17",
	date: "2026-11-05",
	startedAt: new Date("2026-11-05T07:40:00Z"),
}

const CREATED_IN_APP: StudyEncounter = {
	studyInstanceUid: "2.25.1",
	studyId: "2026-000042",
	accessionNumber: undefined,
	date: "2026-07-14",
	startedAt: new Date("2026-07-14T21:59:30Z"),
}

function refusal() {
	return expect.objectContaining({ failure: DICOM_MAPPING_FAILURE.INVALID_VALUE })
}

// integrace-dicom.md 5.2
describe("DICOM study", () => {
	it("NAB-369 takes the Study Instance UID and the Accession Number from the worklist", () => {
		expect(dicomStudyOf(FROM_WORKLIST)).toEqual({
			studyInstanceUid: "1.2.840.113619.2.1",
			studyId: "2026-000041",
			accessionNumber: "ACC-17",
			studyDate: "20261105",
			studyTime: "084000",
			referringPhysicianName: "",
		})
	})

	it("CAP-021-S03 leaves the Accession Number of a visit created in the app empty", () => {
		expect(dicomStudyOf(CREATED_IN_APP).accessionNumber).toBe("")
	})

	it("CAP-014-S33 dates the study by the day of the visit and its start in the Czech time zone", () => {
		expect(dicomStudyOf(CREATED_IN_APP)).toMatchObject({ studyDate: "20260714", studyTime: "235930" })
	})

	it("integrace-dicom.md 5.2 leaves the Study Time empty when the visit has not started", () => {
		expect(dicomStudyOf({ ...FROM_WORKLIST, startedAt: undefined }).studyTime).toBe("")
	})

	it.each([
		["a Study Instance UID with a leading zero", { studyInstanceUid: "2.25.01" }],
		["a Study ID longer than SH", { studyId: "2026-000000000001" }],
		["an Accession Number with a backslash", { accessionNumber: "A\\B" }],
		["an Accession Number longer than SH", { accessionNumber: "ACC-0000000000017" }],
		["a day that is not ISO", { date: "14.07.2026" }],
	])("DICOM PS3.5 6.2 refuses %s (negative)", (_, change) => {
		expect(() => dicomStudyOf({ ...FROM_WORKLIST, ...change })).toThrow(refusal())
	})
})
