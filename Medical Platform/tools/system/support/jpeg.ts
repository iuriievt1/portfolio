// ITU-T T.81 B.1, B.2; CIPA DC-008 4.6, 4.6.6
const MARKER_PREFIX = 0xff
const START_OF_IMAGE = 0xd8
const END_OF_IMAGE = 0xd9
const START_OF_SCAN = 0xda
const MARKER_LENGTH = 2
const LENGTH_FIELD = 2
export const APP1 = 0xe1
export const COMMENT = 0xfe
const SYNTHETIC_COMMENT = "synthetic comment"
const EXIF_HEADER = Buffer.from("Exif\0\0", "latin1")
// TIFF 6.0 2, CIPA DC-008 4.6.6
const TIFF_WITH_GPS = Buffer.from([
	0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, 0x00, 0x01, 0x88, 0x25, 0x00, 0x04, 0x00, 0x00, 0x00, 0x01, 0x00,
	0x00, 0x00, 0x1a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x04, 0x02, 0x03,
	0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
])

export interface JpegLayout {
	headerMarkers: number[]
	scan: Buffer
	trailer: Buffer
}

function isMarkerAt(bytes: Buffer, offset: number, marker: number): boolean {
	return bytes[offset] === MARKER_PREFIX && bytes[offset + 1] === marker
}

function endOfImageAfter(bytes: Buffer, scanStart: number): number {
	const scanHeaderEnd = scanStart + MARKER_LENGTH + bytes.readUInt16BE(scanStart + MARKER_LENGTH)
	for (let offset = scanHeaderEnd; offset < bytes.length - 1; offset += 1) {
		if (isMarkerAt(bytes, offset, END_OF_IMAGE)) {
			return offset
		}
	}
	throw new Error("the JPEG stream has no end of image after its scan")
}

export function jpegLayoutOf(bytes: Buffer): JpegLayout {
	if (!isMarkerAt(bytes, 0, START_OF_IMAGE)) {
		throw new Error("the bytes do not start with a JPEG start of image")
	}
	const headerMarkers: number[] = []
	let offset = MARKER_LENGTH
	while (!isMarkerAt(bytes, offset, START_OF_SCAN)) {
		const marker = bytes[offset + 1]
		if (bytes[offset] !== MARKER_PREFIX || marker === undefined) {
			throw new Error(`no JPEG marker at offset ${offset}`)
		}
		headerMarkers.push(marker)
		offset += MARKER_LENGTH + bytes.readUInt16BE(offset + MARKER_LENGTH)
	}
	const endOfImage = endOfImageAfter(bytes, offset)
	return {
		headerMarkers,
		scan: bytes.subarray(offset, endOfImage + MARKER_LENGTH),
		trailer: bytes.subarray(endOfImage + MARKER_LENGTH),
	}
}

function segmentOf(marker: number, payload: Buffer): Buffer {
	const length = Buffer.alloc(LENGTH_FIELD)
	length.writeUInt16BE(payload.length + LENGTH_FIELD)
	return Buffer.concat([Buffer.from([MARKER_PREFIX, marker]), length, payload])
}

// CAP-021-S07
export function withLocationAndComment(jpeg: Buffer): Buffer {
	return Buffer.concat([
		jpeg.subarray(0, MARKER_LENGTH),
		segmentOf(APP1, Buffer.concat([EXIF_HEADER, TIFF_WITH_GPS])),
		segmentOf(COMMENT, Buffer.from(SYNTHETIC_COMMENT, "latin1")),
		jpeg.subarray(MARKER_LENGTH),
	])
}
