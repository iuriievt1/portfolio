// ITU-T T.81 B.1.1, B.2.2, ITU-T T.871 10.1, ITU-T T.872 6.5.3, ICC.1 B.4, CIPA DC-008 4.6.4

export const SOI = [0xff, 0xd8]
export const EOI = [0xff, 0xd9]
export const BASELINE = 0xc0
export const EXTENDED = 0xc1
export const PROGRESSIVE = 0xc2
export const LOSSLESS = 0xc3
export const ARITHMETIC_PROGRESSIVE = 0xca
export const SHORT_TYPE = 3
export const LONG_TYPE = 4
export const YCBCR_TRANSFORM = 1
export const NO_TRANSFORM = 0

const APP0 = 0xe0
const APP1 = 0xe1
const APP2 = 0xe2
const APP14 = 0xee
const COMMENT_MARKER = 0xfe
const QUANTIZATION_MARKER = 0xdb
const HUFFMAN_MARKER = 0xc4
const SCAN_MARKER = 0xda
const HIERARCHY_MARKER = 0xde
const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]
const TIFF_BYTES = 26
const ORIENTATION_TAG = 0x01_12
const BYTE_BITS = 8
const LOW_BYTE = 0xff

export function segmentOf(marker: number, payload: readonly number[]): number[] {
	const length = payload.length + 2
	return [0xff, marker, length >> BYTE_BITS, length & LOW_BYTE, ...payload]
}

export function ascii(text: string): number[] {
	return [...new TextEncoder().encode(text)]
}

export function jpegOf(...segments: number[][]): Uint8Array {
	return Uint8Array.from([...SOI, ...segments.flat(), ...EOI])
}

interface ExifOptions {
	isLittleEndian?: boolean
	type?: number
}

export function exifWith(
	orientation: number,
	{ isLittleEndian = false, type = SHORT_TYPE }: ExifOptions = {},
): number[] {
	const tiff = new Uint8Array(TIFF_BYTES)
	const view = new DataView(tiff.buffer)
	tiff.set(isLittleEndian ? [0x49, 0x49] : [0x4d, 0x4d], 0)
	view.setUint16(2, 42, isLittleEndian)
	view.setUint32(4, 8, isLittleEndian)
	view.setUint16(8, 1, isLittleEndian)
	view.setUint16(10, ORIENTATION_TAG, isLittleEndian)
	view.setUint16(12, type, isLittleEndian)
	view.setUint32(14, 1, isLittleEndian)
	if (type === LONG_TYPE) {
		view.setUint32(18, orientation, isLittleEndian)
	} else {
		view.setUint16(18, orientation, isLittleEndian)
	}
	return segmentOf(APP1, [...EXIF_HEADER, ...tiff])
}

export function adobeWith(transform: number): number[] {
	return segmentOf(APP14, [...ascii("Adobe"), 0, 100, 0, 0, 0, 0, transform])
}

interface FrameOptions {
	precision?: number
	rows?: number
	columns?: number
	componentCount?: number
}

export function frameOf(
	marker = BASELINE,
	{ precision = 8, rows = 1754, columns = 1240, componentCount = 3 }: FrameOptions = {},
): number[] {
	const components = Array.from({ length: componentCount }, (_, index) => [index + 1, 0x11, 0]).flat()
	return segmentOf(marker, [
		precision,
		rows >> BYTE_BITS,
		rows & LOW_BYTE,
		columns >> BYTE_BITS,
		columns & LOW_BYTE,
		componentCount,
		...components,
	])
}

export const JFIF = segmentOf(APP0, [...ascii("JFIF\0"), 1, 2, 1, 0, 150, 0, 150, 0, 0])
export const JFIF_WITH_THUMBNAIL = segmentOf(APP0, [...ascii("JFIF\0"), 1, 2, 1, 0, 150, 0, 150, 1, 1, 9, 9, 9])
export const JFXX = segmentOf(APP0, [...ascii("JFXX\0"), 0x10, 9, 9])
export const GPS_EXIF = segmentOf(APP1, [
	...EXIF_HEADER,
	0x4d,
	0x4d,
	0,
	42,
	0,
	0,
	0,
	8,
	0,
	0,
	...ascii("49.19N 16.61E"),
])
export const XMP = segmentOf(APP1, ascii("http://ns.adobe.com/xap/1.0/\0<x:xmpmeta/>"))
export const MPF = segmentOf(APP2, ascii("MPF\0data"))
export const ICC = segmentOf(APP2, [...ascii("ICC_PROFILE\0"), 1, 1, 7, 7])
export const ADOBE = adobeWith(YCBCR_TRANSFORM)
export const COMMENT = segmentOf(COMMENT_MARKER, ascii("Pixel 9a, 49.19N 16.61E"))
export const QUANTIZATION = segmentOf(QUANTIZATION_MARKER, [0, 1, 2, 3])
export const HUFFMAN = segmentOf(HUFFMAN_MARKER, [0, 1, 2, 3])
export const HIERARCHY = segmentOf(HIERARCHY_MARKER, [8, 0, 16, 0, 16, 1, 1, 0x11, 0])
export const FRAME = frameOf()
export const SCAN = [...segmentOf(SCAN_MARKER, [1, 1, 0, 0, 0x3f, 0]), 0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56]
export const ZIP_ARCHIVE = [0x50, 0x4b, 0x03, 0x04, ...ascii("payload.sh"), 0x50, 0x4b, 0x05, 0x06]
export const GAIN_MAP = [...SOI, ...segmentOf(COMMENT_MARKER, ascii("gain map")), ...EOI]

export function baselineJpegOf(...metadata: number[][]): Uint8Array {
	return jpegOf(...metadata, QUANTIZATION, HUFFMAN, FRAME, SCAN)
}
