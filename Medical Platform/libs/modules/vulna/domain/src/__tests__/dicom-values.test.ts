import { describe, expect, it } from "vitest"
import { dicomDateOf, dicomMomentIn } from "../dicom/date-time"
import { dicomEquipmentOf } from "../dicom/equipment"
import { dicomInstanceOf } from "../dicom/instance"
import { DICOM_MAPPING_FAILURE } from "../dicom/mapping-error"
import { operatorNameOf, personNameOf } from "../dicom/person-name"
import { dicomSeriesOf, MODALITY } from "../dicom/series"
import { SOP_CLASS } from "../dicom/sop-class"
import { isUid, uidOf } from "../dicom/uid"
import { ordinalOf, paddedLengthOf, stringValueOf, textValueOf } from "../dicom/value-representation"
import { INSTANCE_TIME_ZONE } from "../registry/day-interval"

const HARDWARE_ID = "tHg7xQ2kP9aLmN3vR8sW1yZ4bC6dE0fG2hJ5kL7mN9p"
const SERIES = { seriesInstanceUid: "2.25.7", seriesNumber: 3 }
const OPERATOR = { familyName: "Nováková", givenName: "Jana" }
const INSTANCE = { sopInstanceUid: "2.25.9", instanceNumber: 2, acquiredAt: new Date("2026-03-29T00:59:59.999Z") }
const PERSON_NAME_GROUP_MAX_LENGTH = 64
const LONG_STRING_MAX_LENGTH = 64
const UID_MAX_LENGTH = 64
const INTEGER_STRING_MAX = 2_147_483_647

function refusal() {
	return expect.objectContaining({ failure: DICOM_MAPPING_FAILURE.INVALID_VALUE })
}

// DICOM PS3.5 6.2 DA, TM, DT, integrace-dicom.md 5.8, CAP-015-R28
describe("DICOM dates and times", () => {
	it("DESIGN.md 4.4 writes a moment in the Czech time zone across the change to summer time", () => {
		expect(dicomMomentIn(INSTANCE_TIME_ZONE, new Date("2026-03-29T00:59:59Z"))).toEqual({
			date: "20260329",
			time: "015959",
		})
		expect(dicomMomentIn(INSTANCE_TIME_ZONE, new Date("2026-03-29T01:00:00Z"))).toEqual({
			date: "20260329",
			time: "030000",
		})
	})

	it("DESIGN.md 4.4 writes the repeated hour of the change to winter time as the same local time, without an offset", () => {
		const summer = dicomMomentIn(INSTANCE_TIME_ZONE, new Date("2026-10-25T00:30:00Z"))
		const winter = dicomMomentIn(INSTANCE_TIME_ZONE, new Date("2026-10-25T01:30:00Z"))

		expect(summer).toEqual({ date: "20261025", time: "023000" })
		expect(winter).toEqual(summer)
	})

	it("writes the date of the instance, not of UTC, just after midnight", () => {
		expect(dicomMomentIn(INSTANCE_TIME_ZONE, new Date("2026-12-31T23:30:00Z"))).toEqual({
			date: "20270101",
			time: "003000",
		})
	})

	it("drops the fraction of a second", () => {
		expect(dicomMomentIn(INSTANCE_TIME_ZONE, new Date("2026-07-14T08:15:30.999Z")).time).toBe("101530")
	})

	it("turns an ISO day into DA", () => {
		expect(dicomDateOf("Study Date", "2026-07-14")).toBe("20260714")
		expect(dicomDateOf("Study Date", "2028-02-29")).toBe("20280229")
	})

	it.each([
		["an invalid moment", () => dicomMomentIn(INSTANCE_TIME_ZONE, new Date(Number.NaN))],
		["a year DA cannot hold", () => dicomMomentIn(INSTANCE_TIME_ZONE, new Date("0999-06-01T12:00:00Z"))],
		["a day that is not ISO", () => dicomDateOf("Study Date", "14. 7. 2026")],
		["a day the calendar does not have", () => dicomDateOf("Study Date", "2026-02-31")],
		["a year without a day", () => dicomDateOf("Patient's Birth Date", "1950")],
	])("refuses %s (negative)", (_, map) => {
		expect(map).toThrow(refusal())
	})
})

// DICOM PS3.5 9.1, 6.2 UI, ISO/IEC 9834-1
describe("DICOM UIDs", () => {
	it("takes a UID under a valid root of up to 64 characters", () => {
		expect(uidOf("UID", "1.2.840.10008.1.2.4.50")).toBe("1.2.840.10008.1.2.4.50")
		expect(uidOf("UID", `2.${"1".repeat(62)}`)).toHaveLength(UID_MAX_LENGTH)
	})

	it.each([
		["a UID longer than 64 characters", `2.${"1".repeat(63)}`],
		["a UID of one component", "2"],
		["a UID under a root that is not 0, 1 or 2", "9.99"],
		["a component with a leading zero", "2.25.01"],
		["an empty component", "2..25"],
	])("refuses %s (negative)", (_, value) => {
		expect(isUid(value)).toBe(false)
		expect(() => uidOf("UID", value)).toThrow(refusal())
	})
})

// DICOM PS3.5 6.2 SH, LO, ST, LT, IS
describe("DICOM string values", () => {
	it("DICOM PS3.5 6.2 counts characters, not bytes, and the padding of an odd value into the maximum", () => {
		expect(stringValueOf("LO", "Ř".repeat(LONG_STRING_MAX_LENGTH), LONG_STRING_MAX_LENGTH)).toHaveLength(64)
		expect(() => stringValueOf("LO", `${"x".repeat(63)}Ř`, LONG_STRING_MAX_LENGTH)).toThrow(refusal())
		expect(paddedLengthOf(`${"x".repeat(63)}Ř`)).toBe(LONG_STRING_MAX_LENGTH + 1)
	})

	it.each([
		["a backslash", "a\\b"],
		["a tab", "a\tb"],
		["a broken character", "a\uD800b"],
	])("refuses a string value with %s (negative)", (_, value) => {
		expect(() => stringValueOf("LO", value, LONG_STRING_MAX_LENGTH)).toThrow(refusal())
	})

	it("DICOM PS3.5 6.2 Note 3 takes TAB, CR, LF and a backslash in text", () => {
		expect(textValueOf("LT", "a\tb\r\nc\\d", LONG_STRING_MAX_LENGTH)).toBe("a\tb\r\nc\\d")
	})

	it.each([
		["an escape", "\u001b[0m"],
		["a vertical tab", "a\u000bb"],
		["a C1 control character", "a\u0085b"],
	])("CAP-021-R18 refuses text with %s (negative)", (_, value) => {
		expect(() => textValueOf("LT", value, LONG_STRING_MAX_LENGTH)).toThrow(refusal())
	})

	it("DICOM PS3.5 6.2 IS takes an ordinal up to 2147483647", () => {
		expect(ordinalOf("Instance Number", INTEGER_STRING_MAX)).toBe(INTEGER_STRING_MAX)
		expect(() => ordinalOf("Instance Number", INTEGER_STRING_MAX + 1)).toThrow(refusal())
	})
})

// DICOM PS3.5 6.2 PN, integrace-dicom.md 5.3, CAP-021-R13
describe("DICOM person names", () => {
	it("writes the operator as family name and given name", () => {
		expect(operatorNameOf("Nováková", "Jana")).toBe("Nováková^Jana")
	})

	it("shortens the given name, not the family name, of an operator who does not fit", () => {
		const name = operatorNameOf("Nováková-Svobodová", "J".repeat(PERSON_NAME_GROUP_MAX_LENGTH))

		expect(paddedLengthOf(name)).toBeLessThanOrEqual(PERSON_NAME_GROUP_MAX_LENGTH)
		expect(paddedLengthOf(name)).toBeGreaterThanOrEqual(PERSON_NAME_GROUP_MAX_LENGTH - 1)
		expect(name.startsWith("Nováková-Svobodová^JJJ")).toBe(true)
		expect(name.endsWith("J…")).toBe(true)
	})

	it("keeps only the shortened family name when it alone does not fit", () => {
		expect(operatorNameOf("N".repeat(PERSON_NAME_GROUP_MAX_LENGTH + 1), "Jana")).toBe(
			`${"N".repeat(PERSON_NAME_GROUP_MAX_LENGTH - 1)}…`,
		)
	})

	it("DICOM PS3.5 6.2 counts the padding of an odd value into the 64 characters", () => {
		const given = "J".repeat(PERSON_NAME_GROUP_MAX_LENGTH - "Novak^".length)
		const evenBytes = operatorNameOf("Novak", given)
		const oddBytes = operatorNameOf("Novák", given)

		expect(evenBytes).toBe(`Novak^${given}`)
		expect(oddBytes.endsWith("…")).toBe(true)
		expect(paddedLengthOf(oddBytes)).toBeLessThanOrEqual(PERSON_NAME_GROUP_MAX_LENGTH)
	})

	it("leaves out an empty given name", () => {
		expect(operatorNameOf("Nováková", "")).toBe("Nováková")
	})

	it("DICOM PS3.5 6.2 refuses a patient name whose padding takes it over 64 characters (negative)", () => {
		const evenBytes = `${"N".repeat(PERSON_NAME_GROUP_MAX_LENGTH - 2)}á`
		const oddBytes = `${"N".repeat(PERSON_NAME_GROUP_MAX_LENGTH - 1)}á`

		expect(personNameOf("Patient's Name", evenBytes, undefined)).toBe(evenBytes)
		expect(() => personNameOf("Patient's Name", oddBytes, undefined)).toThrow(refusal())
	})

	it.each([
		["a component separator", "Nová^ková"],
		["a group separator", "Nová=ková"],
		["a backslash", "Nová\\ková"],
		["a control character", "Nová\u0007ková"],
	])("refuses a name with %s (negative)", (_, familyName) => {
		expect(() => operatorNameOf(familyName, "Jana")).toThrow(refusal())
		expect(() => personNameOf("Patient's Name", familyName, "Jana")).toThrow(refusal())
	})
})

// integrace-dicom.md 5.3, CAP-021-R11, CAP-021-R13, NAB-380
describe("DICOM series", () => {
	it("CAP-021-R13 names the operator who founded the record and the closing device by its hardware ID", () => {
		expect(dicomSeriesOf(SERIES, MODALITY.EXTERNAL_CAMERA_PHOTOGRAPHY, OPERATOR, { hardwareId: HARDWARE_ID })).toEqual({
			seriesInstanceUid: "2.25.7",
			seriesNumber: 3,
			modality: "XC",
			operatorsName: "Nováková^Jana",
			stationName: "tHg7xQ2kP9aLmN3v",
		})
	})

	it.each([
		["a hardware ID that is not a SHA-256 in base64url", { station: { hardwareId: "short" } }],
		["a Series Instance UID that is not a UID", { series: { ...SERIES, seriesInstanceUid: "2.25.x" } }],
		["a Series Number below one", { series: { ...SERIES, seriesNumber: 0 } }],
		["a Series Number that is not whole", { series: { ...SERIES, seriesNumber: 1.5 } }],
	])("refuses %s (negative)", (_, change) => {
		const { series, station } = { series: SERIES, station: { hardwareId: HARDWARE_ID }, ...change }
		expect(() => dicomSeriesOf(series, MODALITY.DOCUMENT, OPERATOR, station)).toThrow(refusal())
	})
})

// integrace-dicom.md 5.4, 5.7, 5.8
describe("DICOM instance and equipment", () => {
	it("integrace-dicom.md 5.4 dates the content by the acquisition and the creation by the assembly, in the Czech time zone", () => {
		const builtAt = new Date("2026-11-05T13:45:10Z")

		expect(dicomInstanceOf(SOP_CLASS.ENCAPSULATED_PDF, INSTANCE, builtAt)).toEqual({
			sopClassUid: "1.2.840.10008.5.1.4.1.1.104.1",
			sopInstanceUid: "2.25.9",
			instanceNumber: 2,
			instanceCreationDate: "20261105",
			instanceCreationTime: "144510",
			acquisitionDateTime: "20260329015959",
			contentDate: "20260329",
			contentTime: "015959",
		})
	})

	it("ADR-001 ř. 33 names veevoy and Ansora Vulna Server with the version that built the object", () => {
		expect(dicomEquipmentOf("1.0.0")).toEqual({
			manufacturer: "veevoy",
			manufacturerModelName: "Ansora Vulna Server",
			softwareVersions: "1.0.0",
		})
	})

	it.each([
		[
			"a SOP Instance UID that is not a UID",
			() => dicomInstanceOf(SOP_CLASS.ENCAPSULATED_PDF, { ...INSTANCE, sopInstanceUid: "x" }, new Date()),
		],
		[
			"an Instance Number below one",
			() => dicomInstanceOf(SOP_CLASS.ENCAPSULATED_PDF, { ...INSTANCE, instanceNumber: 0 }, new Date()),
		],
		["an empty software version", () => dicomEquipmentOf("")],
		["a software version with a backslash", () => dicomEquipmentOf("1.0\\2")],
	])("refuses %s (negative)", (_, map) => {
		expect(map).toThrow(refusal())
	})
})
