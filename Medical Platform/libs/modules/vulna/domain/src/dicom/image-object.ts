import type { EditKind } from "../entities/acquisition-file"
import { type DicomAnatomy, dicomAnatomyOf } from "./anatomy"
import { type DicomCommonObject, type DicomCommonSource, dicomCommonOf } from "./dicom-object"
import { type DicomImageStream, dicomImageStreamOf } from "./image-stream"
import { MODALITY } from "./series"
import { SOP_CLASS } from "./sop-class"
import { dicomTextsIn } from "./texts"
import { EMPTY_VALUE } from "./value-representation"
import { dicomImageCommentsOf, dicomWoundOf, type TrackedWound, type WoundAssessment } from "./wound"

// integrace-dicom.md 5.3, 5.4
export interface DicomWoundImage extends DicomAnatomy {
	seriesDescription: string
	imageType: readonly string[]
	derivationDescription: string | undefined
	imageComments: string
	trackingId: string
	trackingUid: string
	patientOrientation: string
	burnedInAnnotation: string
}

// integrace-dicom.md 2, 5, CAP-021-R09
export interface DicomImageObject extends DicomCommonObject {
	wound: DicomWoundImage
	stream: DicomImageStream
}

// integrace-dicom.md 5, CAP-021-R15, CAP-021-R34
export interface DicomImageSource extends DicomCommonSource {
	wound: TrackedWound
	assessment: WoundAssessment
	editKind: EditKind | undefined
	jpeg: Uint8Array
}

// integrace-dicom.md 5.4, CAP-021-R34
const IMAGE_TYPE_ORIGINAL = ["ORIGINAL", "PRIMARY"] as const
const IMAGE_TYPE_DERIVED = ["DERIVED", "PRIMARY"] as const
const NOTHING_BURNED_IN = "NO"

// integrace-dicom.md 2, 5, CAP-021-R09, CAP-021-R26
export function dicomImageObjectOf(source: DicomImageSource): DicomImageObject {
	const { assembly, wound, editKind } = source
	const tracked = dicomWoundOf(wound, assembly.language)
	return {
		...dicomCommonOf(source, MODALITY.EXTERNAL_CAMERA_PHOTOGRAPHY, SOP_CLASS.VL_PHOTOGRAPHIC_IMAGE),
		wound: {
			...dicomAnatomyOf(wound.bodySite),
			seriesDescription: tracked.seriesDescription,
			imageType: editKind === undefined ? IMAGE_TYPE_ORIGINAL : IMAGE_TYPE_DERIVED,
			derivationDescription: editKind === undefined ? undefined : dicomTextsIn(assembly.language).derivation[editKind],
			imageComments: dicomImageCommentsOf(wound, source.assessment, assembly.language),
			trackingId: tracked.trackingId,
			trackingUid: tracked.trackingUid,
			patientOrientation: EMPTY_VALUE,
			burnedInAnnotation: NOTHING_BURNED_IN,
		},
		stream: dicomImageStreamOf(source.jpeg),
	}
}
