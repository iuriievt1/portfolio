import {
	adobeTransformOf,
	exifOrientationOf,
	isJpegStream,
	jpegFrameOf,
	withColourProfileOnly,
} from "../jpeg/jpeg-stream"
import { DICOM_MAPPING_FAILURE, DicomMappingError } from "./mapping-error"

// integrace-dicom.md 5.5
export interface DicomImagePixels {
	rows: number
	columns: number
	samplesPerPixel: number
	photometricInterpretation: string
	planarConfiguration: number | undefined
	bitsAllocated: number
	bitsStored: number
	highBit: number
	pixelRepresentation: number
	lossyImageCompression: string
	lossyImageCompressionMethod: string
}

// integrace-dicom.md 5.5, CAP-021-R07
export interface DicomImageStream {
	bytes: Uint8Array
	pixels: DicomImagePixels
}

// CAP-015-R14, CAP-021-R07
const UPRIGHT_ORIENTATION = 1
// ITU-T T.872 6.5.3, DICOM PS3.5 8.2.1
const YCBCR_TRANSFORM = 1
// integrace-dicom.md 3.1
const BASELINE_PRECISION = 8
const GRAYSCALE_COMPONENTS = 1
const COLOUR_COMPONENTS = 3
// DICOM PS3.5 8.2.1, integrace-dicom.md 5.5
const GRAYSCALE = "MONOCHROME2"
const COLOUR = "YBR_FULL_422"
const COLOUR_BY_PIXEL = 0
const UNSIGNED = 0
// DICOM PS3.3 C.7.6.1.1.5, integrace-dicom.md 5.4
const LOSSY = "01"
const JPEG_LOSSY_METHOD = "ISO_10918_1"

// integrace-dicom.md 3.1, 5.5, CAP-021-R07, ADR-005 ř. 22, 23, Q-043, Q-068, Q-085
export function dicomImageStreamOf(jpeg: Uint8Array): DicomImageStream {
	if (!isJpegStream(jpeg)) {
		throw new DicomMappingError(DICOM_MAPPING_FAILURE.UNSUPPORTED_IMAGE, "the image is not a JPEG stream")
	}
	const orientation = exifOrientationOf(jpeg)
	if (orientation !== undefined && orientation !== UPRIGHT_ORIENTATION) {
		throw new DicomMappingError(DICOM_MAPPING_FAILURE.ROTATED_IMAGE, `the image has Exif Orientation ${orientation}`)
	}
	const bytes = withColourProfileOnly(jpeg)
	const frame = bytes === undefined ? undefined : jpegFrameOf(bytes)
	if (bytes === undefined || frame === undefined) {
		throw new DicomMappingError(DICOM_MAPPING_FAILURE.UNSUPPORTED_IMAGE, "the JPEG stream has no complete frame")
	}
	const isColour = frame.componentCount === COLOUR_COMPONENTS
	const transform = adobeTransformOf(jpeg)
	const isSupported =
		frame.isBaseline &&
		frame.precision === BASELINE_PRECISION &&
		(isColour || frame.componentCount === GRAYSCALE_COMPONENTS) &&
		(!isColour || transform === undefined || transform === YCBCR_TRANSFORM) &&
		frame.rows > 0 &&
		frame.columns > 0
	if (!isSupported) {
		throw new DicomMappingError(
			DICOM_MAPPING_FAILURE.UNSUPPORTED_IMAGE,
			"the image is not a baseline JPEG of 8 bits with one or three components",
		)
	}
	return {
		bytes,
		pixels: {
			rows: frame.rows,
			columns: frame.columns,
			samplesPerPixel: frame.componentCount,
			photometricInterpretation: isColour ? COLOUR : GRAYSCALE,
			planarConfiguration: isColour ? COLOUR_BY_PIXEL : undefined,
			bitsAllocated: BASELINE_PRECISION,
			bitsStored: BASELINE_PRECISION,
			highBit: BASELINE_PRECISION - 1,
			pixelRepresentation: UNSIGNED,
			lossyImageCompression: LOSSY,
			lossyImageCompressionMethod: JPEG_LOSSY_METHOD,
		},
	}
}
