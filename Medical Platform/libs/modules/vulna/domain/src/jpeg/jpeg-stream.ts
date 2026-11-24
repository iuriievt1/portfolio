const MARKER_PREFIX = 0xff
const START_OF_IMAGE = 0xd8
const START_OF_SCAN = 0xda
const END_OF_IMAGE = 0xd9
const APP0 = 0xe0
const APP1 = 0xe1
const APP2 = 0xe2
const APP14 = 0xee
const APP15 = 0xef
const COMMENT = 0xfe
const TEM = 0x01
const RESTART_FIRST = 0xd0
const RESTART_LAST = 0xd7
const MARKER_BYTES = 2
const LENGTH_BYTES = 2
const BYTE_BITS = 8
const LOW_BYTE = 0xff
const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]
const LITTLE_ENDIAN = 0x49
const BIG_ENDIAN = 0x4d
const TIFF_MAGIC = 42
const TIFF_HEADER_BYTES = 8
const IFD_COUNT_BYTES = 2
const IFD_ENTRY_BYTES = 12
const ORIENTATION_TAG = 0x01_12
const SHORT_TYPE = 3
const LONG_TYPE = 4
const ENTRY_TYPE_OFFSET = 2
const ENTRY_VALUE_OFFSET = 8
const IFD_OFFSET_POSITION = 4
const MAGIC_POSITION = 2
const STUFFED_BYTE = 0x00
// ITU-T T.871 10.1
const JFIF_HEADER = [0x4a, 0x46, 0x49, 0x46, 0x00]
const JFIF_HEADER_BYTES = 14
const JFIF_THUMBNAIL_SIZE_OFFSET = 12
const NO_THUMBNAIL = [0x00, 0x00]
// ICC.1 B.4
const ICC_HEADER = [0x49, 0x43, 0x43, 0x5f, 0x50, 0x52, 0x4f, 0x46, 0x49, 0x4c, 0x45, 0x00]
// ITU-T T.872 6.5.3
const ADOBE_HEADER = [0x41, 0x64, 0x6f, 0x62, 0x65]
const ADOBE_TRANSFORM_OFFSET = 11
// ITU-T T.81 B.1.1.3, Table B.1
const BASELINE_DCT = 0xc0
const START_OF_FRAME_FIRST = 0xc0
const START_OF_FRAME_LAST = 0xcf
const DEFINE_HUFFMAN_TABLES = 0xc4
const JPG_EXTENSION = 0xc8
const DEFINE_ARITHMETIC_CODING = 0xcc
const DEFINE_QUANTIZATION_TABLES = 0xdb
const DEFINE_HIERARCHICAL_PROGRESSION = 0xde
const EXPAND_REFERENCE_COMPONENTS = 0xdf
// ITU-T T.81 B.2.2
const FRAME_HEADER_BYTES = 6
const FRAME_COMPONENT_BYTES = 3
const FRAME_PRECISION_OFFSET = 0
const FRAME_ROWS_OFFSET = 1
const FRAME_COLUMNS_OFFSET = 3
const FRAME_COMPONENTS_OFFSET = 5

// ITU-T T.81 B.2.2, integrace-dicom.md 5.5
export interface JpegFrame {
	isBaseline: boolean
	precision: number
	rows: number
	columns: number
	componentCount: number
}

interface SegmentPart {
	kind: "segment"
	marker: number
	bytes: Uint8Array
	payload: Uint8Array
}

interface MarkerPart {
	kind: "marker" | "end"
	bytes: Uint8Array
}

interface EntropyPart {
	kind: "entropy"
	bytes: Uint8Array
}

type JpegPart = SegmentPart | MarkerPart | EntropyPart

interface JpegStructure {
	frames: SegmentPart[]
	isHierarchical: boolean
	hasTablesBeforeScan: boolean
	hasScan: boolean
	isComplete: boolean
}

interface TiffReader {
	short(offset: number): number
	long(offset: number): number
}

function viewOf(bytes: Uint8Array): DataView {
	return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

function tiffReaderOf(tiff: Uint8Array): TiffReader | undefined {
	const view = viewOf(tiff)
	const [first, second] = tiff
	if (first !== second) {
		return undefined
	}
	if (first === LITTLE_ENDIAN) {
		return { short: (offset) => view.getUint16(offset, true), long: (offset) => view.getUint32(offset, true) }
	}
	if (first === BIG_ENDIAN) {
		return { short: (offset) => view.getUint16(offset), long: (offset) => view.getUint32(offset) }
	}
	return undefined
}

// CIPA DC-008 4.6.4, CAP-021-R07
function orientationValueOf(reader: TiffReader, entry: number): number | undefined {
	const type = reader.short(entry + ENTRY_TYPE_OFFSET)
	if (type === SHORT_TYPE) {
		return reader.short(entry + ENTRY_VALUE_OFFSET)
	}
	return type === LONG_TYPE ? reader.long(entry + ENTRY_VALUE_OFFSET) : undefined
}

// CAP-021-R07
function tiffOrientationOf(tiff: Uint8Array): number | undefined {
	if (tiff.length < TIFF_HEADER_BYTES) {
		return undefined
	}
	const reader = tiffReaderOf(tiff)
	if (reader === undefined || reader.short(MAGIC_POSITION) !== TIFF_MAGIC) {
		return undefined
	}
	const directory = reader.long(IFD_OFFSET_POSITION)
	if (directory + IFD_COUNT_BYTES > tiff.length) {
		return undefined
	}
	const entryCount = reader.short(directory)
	for (let index = 0; index < entryCount; index++) {
		const entry = directory + IFD_COUNT_BYTES + index * IFD_ENTRY_BYTES
		if (entry + IFD_ENTRY_BYTES > tiff.length) {
			return undefined
		}
		if (reader.short(entry) === ORIENTATION_TAG) {
			return orientationValueOf(reader, entry)
		}
	}
	return undefined
}

function startsWith(bytes: Uint8Array, header: readonly number[]): boolean {
	return bytes.length >= header.length && header.every((byte, index) => bytes[index] === byte)
}

function isMetadataMarker(marker: number): boolean {
	return (marker >= APP0 && marker <= APP15) || marker === COMMENT
}

function isRestartMarker(marker: number): boolean {
	return marker >= RESTART_FIRST && marker <= RESTART_LAST
}

function isStandaloneMarker(marker: number): boolean {
	return marker === TEM || isRestartMarker(marker)
}

function isStartOfFrame(marker: number): boolean {
	const isFrameCode = marker >= START_OF_FRAME_FIRST && marker <= START_OF_FRAME_LAST
	return (
		isFrameCode && marker !== DEFINE_HUFFMAN_TABLES && marker !== JPG_EXTENSION && marker !== DEFINE_ARITHMETIC_CODING
	)
}

function isColourProfile(segment: SegmentPart): boolean {
	return segment.marker === APP2 && startsWith(segment.payload, ICC_HEADER)
}

function isAdobe(segment: SegmentPart): boolean {
	return segment.marker === APP14 && startsWith(segment.payload, ADOBE_HEADER)
}

function entropyEndOf(jpeg: Uint8Array, start: number): number | undefined {
	for (let offset = start; offset + 1 < jpeg.length; offset++) {
		const next = jpeg[offset + 1] as number
		if (jpeg[offset] === MARKER_PREFIX && next !== STUFFED_BYTE && !isRestartMarker(next)) {
			return offset
		}
	}
	return undefined
}

// ITU-T T.81 B.1.1, B.1.1.2, B.1.1.5
function* partsOf(jpeg: Uint8Array): Generator<JpegPart> {
	if (!isJpegStream(jpeg)) {
		return
	}
	const view = viewOf(jpeg)
	yield { kind: "marker", bytes: jpeg.subarray(0, MARKER_BYTES) }
	let offset = MARKER_BYTES
	while (offset < jpeg.length) {
		const start = offset
		while (jpeg[offset] === MARKER_PREFIX && jpeg[offset + 1] === MARKER_PREFIX) {
			offset += 1
		}
		const marker = jpeg[offset + 1]
		if (jpeg[offset] !== MARKER_PREFIX || marker === undefined) {
			return
		}
		const markerEnd = offset + MARKER_BYTES
		if (marker === END_OF_IMAGE || isStandaloneMarker(marker)) {
			yield { kind: marker === END_OF_IMAGE ? "end" : "marker", bytes: jpeg.subarray(start, markerEnd) }
			if (marker === END_OF_IMAGE) {
				return
			}
			offset = markerEnd
			continue
		}
		const length = markerEnd + LENGTH_BYTES > jpeg.length ? 0 : view.getUint16(markerEnd)
		const segmentEnd = markerEnd + length
		if (length < LENGTH_BYTES || segmentEnd > jpeg.length) {
			return
		}
		const payload = jpeg.subarray(markerEnd + LENGTH_BYTES, segmentEnd)
		yield { kind: "segment", marker, bytes: jpeg.subarray(start, segmentEnd), payload }
		offset = segmentEnd
		if (marker === START_OF_SCAN) {
			const entropyEnd = entropyEndOf(jpeg, segmentEnd)
			if (entropyEnd === undefined) {
				return
			}
			yield { kind: "entropy", bytes: jpeg.subarray(segmentEnd, entropyEnd) }
			offset = entropyEnd
		}
	}
}

function* headerSegmentsOf(jpeg: Uint8Array): Generator<SegmentPart> {
	for (const part of partsOf(jpeg)) {
		if (part.kind === "end" || (part.kind === "segment" && part.marker === START_OF_SCAN)) {
			return
		}
		if (part.kind === "segment") {
			yield part
		}
	}
}

function joined(parts: readonly Uint8Array[]): Uint8Array {
	const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))
	let offset = 0
	for (const part of parts) {
		result.set(part, offset)
		offset += part.length
	}
	return result
}

// NAB-479, CAP-015-R14, CAP-021-R07
function strippedOf(jpeg: Uint8Array, keptMetadataOf: (segment: SegmentPart) => Uint8Array | undefined) {
	const kept: Uint8Array[] = []
	for (const part of partsOf(jpeg)) {
		const isMetadata = part.kind === "segment" && isMetadataMarker(part.marker)
		const bytes = isMetadata ? keptMetadataOf(part) : part.bytes
		if (bytes !== undefined) {
			kept.push(bytes)
		}
		if (part.kind === "end") {
			return joined(kept)
		}
	}
	return undefined
}

// ITU-T T.871 10.1
function jfifWithoutThumbnailOf(payload: Uint8Array): Uint8Array {
	const length = LENGTH_BYTES + JFIF_HEADER_BYTES
	const segment = Uint8Array.from([MARKER_PREFIX, APP0, length >> BYTE_BITS, length & LOW_BYTE])
	const header = payload.slice(0, JFIF_HEADER_BYTES)
	header.set(NO_THUMBNAIL, JFIF_THUMBNAIL_SIZE_OFFSET)
	return joined([segment, header])
}

// CAP-015-R14, ITU-T T.871 10.1
function readableMetadataOf(segment: SegmentPart): Uint8Array | undefined {
	const isJfif = segment.marker === APP0 && startsWith(segment.payload, JFIF_HEADER)
	if (isJfif && segment.payload.length >= JFIF_HEADER_BYTES) {
		return jfifWithoutThumbnailOf(segment.payload)
	}
	return isColourProfile(segment) || isAdobe(segment) ? segment.bytes : undefined
}

// CAP-021-R07, integrace-dicom.md 5.5, DICOM PS3.5 8.2.1
function colourProfileOf(segment: SegmentPart): Uint8Array | undefined {
	return isColourProfile(segment) ? segment.bytes : undefined
}

// ITU-T T.81 B.2.2
function frameOf(segment: SegmentPart): JpegFrame | undefined {
	const { payload } = segment
	if (payload.length < FRAME_HEADER_BYTES) {
		return undefined
	}
	const view = viewOf(payload)
	const componentCount = view.getUint8(FRAME_COMPONENTS_OFFSET)
	if (payload.length !== FRAME_HEADER_BYTES + componentCount * FRAME_COMPONENT_BYTES) {
		return undefined
	}
	return {
		isBaseline: segment.marker === BASELINE_DCT,
		precision: view.getUint8(FRAME_PRECISION_OFFSET),
		rows: view.getUint16(FRAME_ROWS_OFFSET),
		columns: view.getUint16(FRAME_COLUMNS_OFFSET),
		componentCount,
	}
}

// ITU-T T.81 B.2, B.3, DICOM PS3.5 8.2.1
function structureOf(jpeg: Uint8Array): JpegStructure {
	const structure: JpegStructure = {
		frames: [],
		isHierarchical: false,
		hasTablesBeforeScan: false,
		hasScan: false,
		isComplete: false,
	}
	let hasQuantization = false
	let hasHuffman = false
	for (const part of partsOf(jpeg)) {
		if (part.kind === "end") {
			structure.isComplete = true
		}
		if (part.kind !== "segment") {
			continue
		}
		const { marker } = part
		if (isStartOfFrame(marker)) {
			structure.frames.push(part)
		}
		structure.isHierarchical ||= marker === DEFINE_HIERARCHICAL_PROGRESSION || marker === EXPAND_REFERENCE_COMPONENTS
		if (!structure.hasScan) {
			hasQuantization ||= marker === DEFINE_QUANTIZATION_TABLES
			hasHuffman ||= marker === DEFINE_HUFFMAN_TABLES
			structure.hasTablesBeforeScan = hasQuantization && hasHuffman
		}
		structure.hasScan ||= marker === START_OF_SCAN
	}
	return structure
}

// CAP-021-R07, CAP-015-R04, clinical-workflow.yaml ImageUpload.image
export function isJpegStream(bytes: Uint8Array): boolean {
	return bytes[0] === MARKER_PREFIX && bytes[1] === START_OF_IMAGE
}

// CAP-021-R07, CAP-015-R14
export function exifOrientationOf(jpeg: Uint8Array): number | undefined {
	for (const segment of headerSegmentsOf(jpeg)) {
		const isExif = segment.marker === APP1 && startsWith(segment.payload, EXIF_HEADER)
		const orientation = isExif ? tiffOrientationOf(segment.payload.subarray(EXIF_HEADER.length)) : undefined
		if (orientation !== undefined) {
			return orientation
		}
	}
	return undefined
}

// ITU-T T.872 6.5.3, DICOM PS3.5 8.2.1, integrace-dicom.md 5.5
export function adobeTransformOf(jpeg: Uint8Array): number | undefined {
	for (const segment of headerSegmentsOf(jpeg)) {
		if (isAdobe(segment) && segment.payload.length > ADOBE_TRANSFORM_OFFSET) {
			return segment.payload[ADOBE_TRANSFORM_OFFSET]
		}
	}
	return undefined
}

// ITU-T T.81 B.2.2, DICOM PS3.5 8.2.1, CAP-021-R07, integrace-dicom.md 3.1, 5.5
export function jpegFrameOf(jpeg: Uint8Array): JpegFrame | undefined {
	const structure = structureOf(jpeg)
	const [segment, ...others] = structure.frames
	const isInterchange = structure.isComplete && structure.hasScan && structure.hasTablesBeforeScan
	const frame = segment === undefined || others.length > 0 || !isInterchange ? undefined : frameOf(segment)
	return frame === undefined ? undefined : { ...frame, isBaseline: frame.isBaseline && !structure.isHierarchical }
}

// NAB-479, CAP-015-R14
export function withoutMetadata(jpeg: Uint8Array): Uint8Array | undefined {
	return strippedOf(jpeg, readableMetadataOf)
}

// CAP-021-R07, integrace-dicom.md 5.5, DICOM PS3.5 8.2.1, Q-068, Q-085
export function withColourProfileOnly(jpeg: Uint8Array): Uint8Array | undefined {
	return strippedOf(jpeg, colourProfileOf)
}
