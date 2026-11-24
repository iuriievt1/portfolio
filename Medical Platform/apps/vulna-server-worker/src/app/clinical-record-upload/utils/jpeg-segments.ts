// JPEG ITU-T T.81 B.1.1, EXIF 2.3 4.6, ICC.1 B.4
const MARKER_PREFIX = 0xff
const START_OF_SCAN = 0xda
const END_OF_IMAGE = 0xd9
const APP0 = 0xe0
const APP1 = 0xe1
const APP2 = 0xe2
const SEGMENT_HEADER_BYTES = 4
const MARKER_BYTES = 2
const SOI_BYTES = 2
const STANDALONE_MARKERS = new Set([0x01, 0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8])
const EXIF_SIGNATURE = "Exif\0\0"
const ICC_SIGNATURE = "ICC_PROFILE\0"
const TIFF_LITTLE_ENDIAN = "II"
const TIFF_MAGIC = 42
const TIFF_MAGIC_OFFSET = 2
const FIRST_IFD_OFFSET = 4
const TIFF_HEADER_BYTES = 8
const IFD_COUNT_BYTES = 2
const IFD_ENTRY_BYTES = 12
const ENTRY_TYPE_OFFSET = 2
const ENTRY_VALUE_OFFSET = 8
const ORIENTATION_TAG = 0x01_12
const SHORT_TYPE = 3

// EXIF 2.3 4.6.4 Orientation
export const ORIENTATION = {
	NORMAL: 1,
	MIRRORED: 2,
	ROTATED_180: 3,
	FLIPPED: 4,
	TRANSPOSED: 5,
	ROTATED_90: 6,
	TRANSVERSED: 7,
	ROTATED_270: 8,
} as const

export type Orientation = (typeof ORIENTATION)[keyof typeof ORIENTATION]

const ORIENTATIONS: ReadonlySet<number> = new Set(Object.values(ORIENTATION))

export interface JpegMetadata {
	orientation: Orientation
	iccSegments: readonly Uint8Array[]
}

interface Segment {
	marker: number
	start: number
	payload: Uint8Array
}

function startsWith(bytes: Uint8Array, signature: string): boolean {
	if (bytes.length < signature.length) {
		return false
	}
	for (let index = 0; index < signature.length; index += 1) {
		if (bytes[index] !== signature.charCodeAt(index)) {
			return false
		}
	}
	return true
}

function segmentsBeforeScan(jpeg: Uint8Array): Segment[] {
	const view = new DataView(jpeg.buffer, jpeg.byteOffset, jpeg.byteLength)
	const segments: Segment[] = []
	let offset = SOI_BYTES
	while (offset + SEGMENT_HEADER_BYTES <= jpeg.length) {
		if (jpeg[offset] !== MARKER_PREFIX) {
			return segments
		}
		const marker = jpeg[offset + 1] ?? END_OF_IMAGE
		if (marker === MARKER_PREFIX) {
			offset += 1
			continue
		}
		if (marker === START_OF_SCAN || marker === END_OF_IMAGE) {
			return segments
		}
		if (STANDALONE_MARKERS.has(marker)) {
			offset += MARKER_BYTES
			continue
		}
		const length = view.getUint16(offset + MARKER_BYTES)
		const end = offset + MARKER_BYTES + length
		if (length < MARKER_BYTES || end > jpeg.length) {
			return segments
		}
		segments.push({ marker, start: offset, payload: jpeg.subarray(offset + SEGMENT_HEADER_BYTES, end) })
		offset = end
	}
	return segments
}

function orientationOfTiff(tiff: Uint8Array): Orientation {
	if (tiff.length < TIFF_HEADER_BYTES) {
		return ORIENTATION.NORMAL
	}
	const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength)
	const littleEndian = startsWith(tiff, TIFF_LITTLE_ENDIAN)
	if (view.getUint16(TIFF_MAGIC_OFFSET, littleEndian) !== TIFF_MAGIC) {
		return ORIENTATION.NORMAL
	}
	const directory = view.getUint32(FIRST_IFD_OFFSET, littleEndian)
	if (directory + IFD_COUNT_BYTES > tiff.length) {
		return ORIENTATION.NORMAL
	}
	const entries = view.getUint16(directory, littleEndian)
	for (let index = 0; index < entries; index += 1) {
		const entry = directory + IFD_COUNT_BYTES + index * IFD_ENTRY_BYTES
		if (entry + IFD_ENTRY_BYTES > tiff.length) {
			return ORIENTATION.NORMAL
		}
		if (view.getUint16(entry, littleEndian) !== ORIENTATION_TAG) {
			continue
		}
		if (view.getUint16(entry + ENTRY_TYPE_OFFSET, littleEndian) !== SHORT_TYPE) {
			return ORIENTATION.NORMAL
		}
		const value = view.getUint16(entry + ENTRY_VALUE_OFFSET, littleEndian)
		return ORIENTATIONS.has(value) ? (value as Orientation) : ORIENTATION.NORMAL
	}
	return ORIENTATION.NORMAL
}

// CAP-021-R40
export function metadataOf(jpeg: Uint8Array): JpegMetadata {
	let orientation: Orientation = ORIENTATION.NORMAL
	const iccSegments: Uint8Array[] = []
	for (const segment of segmentsBeforeScan(jpeg)) {
		if (segment.marker === APP1 && startsWith(segment.payload, EXIF_SIGNATURE)) {
			orientation = orientationOfTiff(segment.payload.subarray(EXIF_SIGNATURE.length))
		}
		if (segment.marker === APP2 && startsWith(segment.payload, ICC_SIGNATURE)) {
			iccSegments.push(jpeg.subarray(segment.start, segment.start + SEGMENT_HEADER_BYTES + segment.payload.length))
		}
	}
	return { orientation, iccSegments }
}

// CAP-021-R40, ICC.1 B.4
export function withSegments(jpeg: Uint8Array, segments: readonly Uint8Array[]): Buffer {
	const leading = segmentsBeforeScan(jpeg)[0]
	const insertAt = leading?.marker === APP0 ? leading.start + SEGMENT_HEADER_BYTES + leading.payload.length : SOI_BYTES
	return Buffer.concat([jpeg.subarray(0, insertAt), ...segments, jpeg.subarray(insertAt)])
}
