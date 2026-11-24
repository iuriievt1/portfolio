import { encode } from "jpeg-js"
import type { Orientation } from "../utils/jpeg-segments"
import type { Raster } from "../utils/raster"

const CHANNELS = 4
const OPAQUE = 255
const QUALITY = 90
// JPEG ITU-T T.81 B.1.1: SOI followed by the JFIF APP0 segment jpeg-js writes
const SOI_AND_APP0_BYTES = 20
const APP1 = 0xe1
const APP2 = 0xe2

export const ICC_PROFILE_BYTES = Buffer.from("synthetic colour profile")

export type Colour = readonly [number, number, number]

export function rasterOf(width: number, height: number, colourAt: (x: number, y: number) => Colour): Raster {
	const data = new Uint8Array(width * height * CHANNELS)
	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			data.set([...colourAt(x, y), OPAQUE], (y * width + x) * CHANNELS)
		}
	}
	return { width, height, data }
}

export function jpegOf(raster: Raster): Buffer {
	return encode(raster, QUALITY).data
}

function segmentOf(marker: number, payload: Buffer): Buffer {
	const header = Buffer.alloc(4)
	header.writeUInt8(0xff, 0)
	header.writeUInt8(marker, 1)
	header.writeUInt16BE(payload.length + 2, 2)
	return Buffer.concat([header, payload])
}

// EXIF 2.3 4.6.2, TIFF 6.0 2
export function exifSegment(orientation: number, isLittleEndian = true): Buffer {
	const tiff = Buffer.alloc(26)
	const write16 = (value: number, offset: number) =>
		isLittleEndian ? tiff.writeUInt16LE(value, offset) : tiff.writeUInt16BE(value, offset)
	const write32 = (value: number, offset: number) =>
		isLittleEndian ? tiff.writeUInt32LE(value, offset) : tiff.writeUInt32BE(value, offset)
	tiff.write(isLittleEndian ? "II" : "MM", 0, "latin1")
	write16(42, 2)
	write32(8, 4)
	write16(1, 8)
	write16(0x01_12, 10)
	write16(3, 12)
	write32(1, 14)
	write16(orientation, 18)
	write32(0, 22)
	return segmentOf(APP1, Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff]))
}

// ICC.1 B.4
export function iccSegment(): Buffer {
	return segmentOf(
		APP2,
		Buffer.concat([Buffer.from("ICC_PROFILE\0", "latin1"), Buffer.from([1, 1]), ICC_PROFILE_BYTES]),
	)
}

export function withLeading(jpeg: Buffer, segments: readonly Buffer[]): Buffer {
	return Buffer.concat([jpeg.subarray(0, SOI_AND_APP0_BYTES), ...segments, jpeg.subarray(SOI_AND_APP0_BYTES)])
}

export function photoOf(raster: Raster, orientation: Orientation): Buffer {
	return withLeading(jpegOf(raster), [exifSegment(orientation), iccSegment()])
}
