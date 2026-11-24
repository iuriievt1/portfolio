import { LATERALITY, type Laterality } from "@ansora/contracts"
import { type BodySite, bodySiteRegionOf, drawnBodySurfaceOf } from "../body-diagram/body-site"
import { BODY_SURFACE, type BodySurface } from "../body-diagram/body-surface"
import { DICOM_MAPPING_FAILURE, DicomMappingError } from "./mapping-error"

// DICOM PS3.3 8.8, PS3.16 8
export interface DicomCode {
	codeValue: string
	codingSchemeDesignator: string
	codeMeaning: string
}

// integrace-dicom.md 5.3, 5.4
export interface DicomAnatomy {
	bodyPartExamined: string
	laterality: Laterality | undefined
	anatomicRegion: DicomCode
	anatomicRegionModifiers: readonly DicomCode[]
}

// DICOM PS3.16 Annex L
interface DicomBodyPart {
	bodyPartExamined: string
	isPaired: boolean
}

// DICOM PS3.16 8.1
const SNOMED_CT = "SCT"

// DICOM PS3.16 Annex L, Table L-5, integrace-dicom.md 5.3, NAB-374, NAB-376, Q-087
const BODY_PARTS: Readonly<Record<string, DicomBodyPart>> = {
	"818981001": { bodyPartExamined: "ABDOMEN", isPaired: false },
	"70258002": { bodyPartExamined: "ANKLE", isPaired: true },
	"53505006": { bodyPartExamined: "ANUS", isPaired: false },
	"76752008": { bodyPartExamined: "BREAST", isPaired: true },
	"816094009": { bodyPartExamined: "CHEST", isPaired: false },
	"16953009": { bodyPartExamined: "ELBOW", isPaired: true },
	"7569003": { bodyPartExamined: "FINGER", isPaired: true },
	"56459004": { bodyPartExamined: "FOOT", isPaired: true },
	"14975008": { bodyPartExamined: "FOREARM", isPaired: true },
	"85562004": { bodyPartExamined: "HAND", isPaired: true },
	"69536005": { bodyPartExamined: "HEAD", isPaired: false },
	// Q-087
	"371398005": { bodyPartExamined: "HEAD", isPaired: false },
	// Q-087
	"29836001": { bodyPartExamined: "HIP", isPaired: true },
	"661005": { bodyPartExamined: "JAW", isPaired: false },
	"72696002": { bodyPartExamined: "KNEE", isPaired: true },
	"30021000": { bodyPartExamined: "LOWERLEG", isPaired: true },
	"63337009": { bodyPartExamined: "LOWERTRUNK", isPaired: false },
	"45048000": { bodyPartExamined: "NECK", isPaired: false },
	"816092008": { bodyPartExamined: "PELVIS", isPaired: false },
	"79601000": { bodyPartExamined: "SCAPULA", isPaired: true },
	"54735007": { bodyPartExamined: "SSPINE", isPaired: false },
	"68367000": { bodyPartExamined: "THIGH", isPaired: true },
	"29707007": { bodyPartExamined: "TOE", isPaired: true },
	"40983000": { bodyPartExamined: "UPPERARM", isPaired: true },
}

// DICOM PS3.16 CID 2, integrace-dicom.md 5.4, CAP-021-R14, CAP-016-R20, Q-146
const SURFACE_MODIFIERS: Readonly<Record<BodySurface, DicomCode>> = {
	[BODY_SURFACE.ANTERIOR]: { codeValue: "255549009", codingSchemeDesignator: SNOMED_CT, codeMeaning: "Anterior" },
	[BODY_SURFACE.POSTERIOR]: { codeValue: "255551008", codingSchemeDesignator: SNOMED_CT, codeMeaning: "Posterior" },
	// Q-146
	[BODY_SURFACE.PLANTAR]: { codeValue: "261089000", codingSchemeDesignator: SNOMED_CT, codeMeaning: "Inferior" },
	[BODY_SURFACE.MEDIAL]: { codeValue: "255561001", codingSchemeDesignator: SNOMED_CT, codeMeaning: "Medial" },
	[BODY_SURFACE.LATERAL]: { codeValue: "49370004", codingSchemeDesignator: SNOMED_CT, codeMeaning: "Lateral" },
}

// DICOM PS3.3 10.5, C.7.3.1, PS3.16 CID 244, CAP-016-R16
const SIDE_MODIFIERS: Readonly<Record<Laterality, DicomCode>> = {
	[LATERALITY.RIGHT]: { codeValue: "24028007", codingSchemeDesignator: SNOMED_CT, codeMeaning: "Right" },
	[LATERALITY.LEFT]: { codeValue: "7771000", codingSchemeDesignator: SNOMED_CT, codeMeaning: "Left" },
}

// integrace-dicom.md 5.3, 5.4, CAP-021-R14, CAP-016-R03, CAP-016-R11, CAP-016-R16, DICOM PS3.3 10.5, C.7.3.1
export function dicomAnatomyOf(site: BodySite): DicomAnatomy {
	const region = bodySiteRegionOf(site)
	const surface = drawnBodySurfaceOf(site)
	const bodyPart = region === undefined ? undefined : BODY_PARTS[region.dicomRegion.code]
	if (region === undefined || surface === undefined || bodyPart === undefined) {
		throw new DicomMappingError(
			DICOM_MAPPING_FAILURE.UNKNOWN_BODY_SITE,
			`no region ${site.regionCode} with a DICOM body part and a surface in the body diagram ${site.bodyDiagramVersion}`,
		)
	}
	const anatomy = {
		bodyPartExamined: bodyPart.bodyPartExamined,
		anatomicRegion: {
			codeValue: region.dicomRegion.code,
			codingSchemeDesignator: SNOMED_CT,
			codeMeaning: region.dicomRegion.meaning,
		},
	}
	const surfaceModifier = SURFACE_MODIFIERS[surface]
	if (!bodyPart.isPaired) {
		const side = site.laterality === null ? [] : [SIDE_MODIFIERS[site.laterality]]
		return { ...anatomy, laterality: undefined, anatomicRegionModifiers: [surfaceModifier, ...side] }
	}
	if (site.laterality === null) {
		throw new DicomMappingError(
			DICOM_MAPPING_FAILURE.UNKNOWN_BODY_SITE,
			`the paired body part ${bodyPart.bodyPartExamined} of the region ${site.regionCode} has no side`,
		)
	}
	return { ...anatomy, laterality: site.laterality, anatomicRegionModifiers: [surfaceModifier] }
}
