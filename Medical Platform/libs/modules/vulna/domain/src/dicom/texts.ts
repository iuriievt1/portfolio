import { BODY_VIEW, type BodyView, isSameLanguage, LATERALITY, type Laterality } from "@ansora/contracts"
import { EDIT_KIND, type EditKind } from "../entities/acquisition-file"
import { DICOM_MAPPING_FAILURE, DicomMappingError } from "./mapping-error"

// integrace-dicom.md 5.8, CAP-021-R26, CAP-016-R19
export interface DicomTexts {
	woundLabel: string
	patientSide: Readonly<Record<Laterality, string>>
	shortSide: Readonly<Record<Laterality, string>>
	view: Readonly<Record<BodyView, string>>
	woundType: string
	healingPhase: string
	// integrace-dicom.md 5.4, CAP-021-R34
	derivation: Readonly<Record<EditKind, string>>
}

export const WOUND_NUMBER_PLACEHOLDER = "{number}"

const DICOM_TEXTS: Readonly<Record<string, DicomTexts>> = {
	cs: {
		woundLabel: "Rána {number}",
		patientSide: { [LATERALITY.RIGHT]: "pravá strana pacienta", [LATERALITY.LEFT]: "levá strana pacienta" },
		shortSide: { [LATERALITY.RIGHT]: "pravá strana", [LATERALITY.LEFT]: "levá strana" },
		view: {
			[BODY_VIEW.ANTERIOR]: "zepředu",
			[BODY_VIEW.POSTERIOR]: "zezadu",
			[BODY_VIEW.RIGHT_LATERAL]: "z pravého boku",
			[BODY_VIEW.LEFT_LATERAL]: "z levého boku",
			[BODY_VIEW.PLANTAR]: "zespodu",
			[BODY_VIEW.DORSAL]: "shora",
		},
		woundType: "Typ rány",
		healingPhase: "Fáze hojení",
		derivation: {
			[EDIT_KIND.ROTATION]: "Otočeno pořizovatelem před uzavřením záznamu",
			[EDIT_KIND.CROP]: "Oříznuto pořizovatelem před uzavřením záznamu",
			[EDIT_KIND.ROTATION_AND_CROP]: "Otočeno a oříznuto pořizovatelem před uzavřením záznamu",
		},
	},
	en: {
		woundLabel: "Wound {number}",
		patientSide: { [LATERALITY.RIGHT]: "patient's right side", [LATERALITY.LEFT]: "patient's left side" },
		shortSide: { [LATERALITY.RIGHT]: "right side", [LATERALITY.LEFT]: "left side" },
		view: {
			[BODY_VIEW.ANTERIOR]: "from the front",
			[BODY_VIEW.POSTERIOR]: "from the back",
			[BODY_VIEW.RIGHT_LATERAL]: "from the right side",
			[BODY_VIEW.LEFT_LATERAL]: "from the left side",
			[BODY_VIEW.PLANTAR]: "from below",
			[BODY_VIEW.DORSAL]: "from above",
		},
		woundType: "Wound type",
		healingPhase: "Healing phase",
		derivation: {
			[EDIT_KIND.ROTATION]: "Rotated by the operator before the record was closed",
			[EDIT_KIND.CROP]: "Cropped by the operator before the record was closed",
			[EDIT_KIND.ROTATION_AND_CROP]: "Rotated and cropped by the operator before the record was closed",
		},
	},
}

function textsKeyOf(language: string): string | undefined {
	return Object.keys(DICOM_TEXTS).find((candidate) => isSameLanguage(candidate, language))
}

// CAP-021-R26, CAP-015-R23
export function hasDicomTextsIn(language: string): boolean {
	return textsKeyOf(language) !== undefined
}

// CAP-021-R26, CAP-015-R23, datovy-model.md 2
export function dicomTextsIn(language: string): DicomTexts {
	const key = textsKeyOf(language)
	const texts = key === undefined ? undefined : DICOM_TEXTS[key]
	if (texts === undefined) {
		throw new DicomMappingError(DICOM_MAPPING_FAILURE.UNSUPPORTED_LANGUAGE, `no DICOM texts in ${language}`)
	}
	return texts
}
