import { type LocalizedNames, nameIn } from "@ansora/contracts"
import { type BodySite, bodySiteRegionOf } from "../body-diagram/body-site"
import { DICOM_MAPPING_FAILURE, DicomMappingError } from "./mapping-error"
import { type DicomTexts, dicomTextsIn, WOUND_NUMBER_PLACEHOLDER } from "./texts"
import { uidOfUuid } from "./uid"
import {
	EMPTY_VALUE,
	fittedTo,
	LONG_STRING_MAX_LENGTH,
	LONG_TEXT_MAX_LENGTH,
	ordinalOf,
	stringValueOf,
	textValueOf,
} from "./value-representation"

// integrace-dicom.md 5.3, 5.4, CAP-021-R15, CAP-020-R23
export interface TrackedWound {
	findingId: string
	woundNumber: number
	bodySite: BodySite
}

// integrace-dicom.md 5.3, 5.4
export interface DicomWound {
	seriesDescription: string
	trackingId: string
	trackingUid: string
}

// integrace-dicom.md 5.4, CAP-021-R15, CAP-017-R16, CAP-017-R18
export interface WoundAssessment {
	woundTypeNames: LocalizedNames | undefined
	healingPhaseNames: LocalizedNames | undefined
	description: string | undefined
}

const PART_SEPARATOR = " · "
// DICOM PS3.5 6.2 LT
const LINE_SEPARATOR = "\r\n"
const LABEL_SEPARATOR = ": "

// integrace-dicom.md 5.3, 5.4, 5.8, CAP-021-R15, CAP-021-R26, CAP-016-R11
export function dicomWoundOf(wound: TrackedWound, language: string): DicomWound {
	const texts = dicomTextsIn(language)
	const label = woundLabelOf(wound.woundNumber, texts)
	const side = wound.bodySite.laterality === null ? [] : [texts.shortSide[wound.bodySite.laterality]]
	return {
		seriesDescription: seriesDescriptionOf(label, regionNameOf(wound.bodySite, language), side),
		trackingId: label,
		trackingUid: uidOfUuid(wound.findingId),
	}
}

// integrace-dicom.md 5.4, 5.8, CAP-021-R15, CAP-021-R26, CAP-017-R17
export function dicomImageCommentsOf(wound: TrackedWound, assessment: WoundAssessment, language: string): string {
	const texts = dicomTextsIn(language)
	const headLines = [
		placeOf(wound, texts, language),
		...labelledLine(texts.woundType, assessment.woundTypeNames, language),
		...labelledLine(texts.healingPhase, assessment.healingPhaseNames, language),
	]
	const comments = withFreeText(headLines.join(LINE_SEPARATOR), assessment.description)
	return textValueOf("Image Comments", comments, LONG_TEXT_MAX_LENGTH)
}

// CAP-020-R23
function woundLabelOf(woundNumber: number, texts: DicomTexts): string {
	return texts.woundLabel.replace(WOUND_NUMBER_PLACEHOLDER, String(ordinalOf("wound number", woundNumber)))
}

// CAP-016-R19, CAP-016-R11
function placeOf(wound: TrackedWound, texts: DicomTexts, language: string): string {
	const { laterality, view } = wound.bodySite
	const side = laterality === null ? [] : [texts.patientSide[laterality]]
	const label = woundLabelOf(wound.woundNumber, texts)
	return [label, regionNameOf(wound.bodySite, language), ...side, texts.view[view]].join(PART_SEPARATOR)
}

function labelledLine(label: string, names: LocalizedNames | undefined, language: string): readonly string[] {
	return names === undefined ? [] : [`${label}${LABEL_SEPARATOR}${nameOf(names, language)}`]
}

// CAP-016-R18, CAP-016-R08
function regionNameOf(bodySite: BodySite, language: string): string {
	const region = bodySiteRegionOf(bodySite)
	if (region === undefined) {
		throw new DicomMappingError(
			DICOM_MAPPING_FAILURE.UNKNOWN_BODY_SITE,
			`no region ${bodySite.regionCode} in the body diagram ${bodySite.bodyDiagramVersion}`,
		)
	}
	return nameOf(region.names, language)
}

// CAP-021-R26, CAP-017-R18
function nameOf(names: LocalizedNames, language: string): string {
	const name = nameIn(names, language)
	if (name === undefined) {
		throw new DicomMappingError(DICOM_MAPPING_FAILURE.UNSUPPORTED_LANGUAGE, `a name is missing in ${language}`)
	}
	return name
}

// DICOM PS3.5 6.2 LO, CAP-017-R17
function seriesDescriptionOf(label: string, region: string, side: readonly string[]): string {
	const description = fittedTo(region, LONG_STRING_MAX_LENGTH, (part) => [label, part, ...side].join(PART_SEPARATOR))
	if (description === undefined) {
		throw new DicomMappingError(DICOM_MAPPING_FAILURE.INVALID_VALUE, "Series Description cannot hold the wound label")
	}
	return stringValueOf("Series Description", description, LONG_STRING_MAX_LENGTH)
}

// DICOM PS3.5 6.2 LT, CAP-021-R26, CAP-017-R17
function withFreeText(head: string, description: string | undefined): string {
	if (description === undefined || description === EMPTY_VALUE) {
		return head
	}
	const comments = fittedTo(description, LONG_TEXT_MAX_LENGTH, (part) => `${head}${LINE_SEPARATOR}${part}`)
	if (comments === undefined) {
		throw new DicomMappingError(
			DICOM_MAPPING_FAILURE.INVALID_VALUE,
			"Image Comments cannot hold the place of the wound",
		)
	}
	return comments
}
