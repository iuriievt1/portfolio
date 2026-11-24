import { DICOM_MAPPING_FAILURE, DicomMappingError } from "./mapping-error"
import { EMPTY_VALUE, fittedTo, PERSON_NAME_GROUP_MAX_LENGTH, paddedLengthOf } from "./value-representation"

// DICOM PS3.5 6.2 PN
const PERSON_NAME_COMPONENT_SEPARATOR = "^"
const PERSON_NAME_COMPONENT_PATTERN = /^[^\\^=\p{Cc}\p{Cs}]+$/u
// integrace-dicom.md 5.3
const OPERATORS_NAME = "Operators' Name"

// DICOM PS3.5 6.2 PN, integrace-dicom.md 5.1
export function personNameOf(attribute: string, familyName: string | undefined, givenName: string | undefined): string {
	const name = joinedName(attribute, [familyName ?? EMPTY_VALUE, givenName ?? EMPTY_VALUE])
	if (paddedLengthOf(name) > PERSON_NAME_GROUP_MAX_LENGTH) {
		throw new DicomMappingError(DICOM_MAPPING_FAILURE.INVALID_VALUE, `${attribute} is longer than DICOM PN allows`)
	}
	return name
}

// integrace-dicom.md 5.3, CAP-021-R13
export function operatorNameOf(familyName: string, givenName: string): string {
	const withGiven = (given: string) => joinedName(OPERATORS_NAME, [familyName, given])
	const withFamily = (family: string) => joinedName(OPERATORS_NAME, [family])
	const name =
		fittedTo(givenName, PERSON_NAME_GROUP_MAX_LENGTH, withGiven) ??
		fittedTo(familyName, PERSON_NAME_GROUP_MAX_LENGTH, withFamily)
	if (name === undefined) {
		throw new DicomMappingError(DICOM_MAPPING_FAILURE.INVALID_VALUE, `${OPERATORS_NAME} does not fit DICOM PN`)
	}
	return name
}

function joinedName(attribute: string, components: readonly string[]): string {
	if (components.some((component) => component !== EMPTY_VALUE && !PERSON_NAME_COMPONENT_PATTERN.test(component))) {
		throw new DicomMappingError(DICOM_MAPPING_FAILURE.INVALID_VALUE, `${attribute} is not a DICOM PN value`)
	}
	return withoutTrailingEmpty(components).join(PERSON_NAME_COMPONENT_SEPARATOR)
}

function withoutTrailingEmpty(components: readonly string[]): readonly string[] {
	const lastFilled = components.findLastIndex((component) => component !== EMPTY_VALUE)
	return components.slice(0, lastFilled + 1)
}
