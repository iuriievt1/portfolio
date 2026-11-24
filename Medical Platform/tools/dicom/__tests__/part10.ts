import { Dataset } from "@veevoy/dcmjs-dimse"
import { CLIENT_IMPLEMENTATION_CLASS_UID } from "../synthetic"
import { JPEG_BASELINE, SECONDARY_CAPTURE_IMAGE_STORAGE } from "../uids"

// PS3.10 7.1, PS3.5 7.1.2, A.4, CAP-012-R17, Q-040

const TAG = {
	FILE_META_INFORMATION_GROUP_LENGTH: 0x00_02_00_00,
	FILE_META_INFORMATION_VERSION: 0x00_02_00_01,
	MEDIA_STORAGE_SOP_CLASS_UID: 0x00_02_00_02,
	MEDIA_STORAGE_SOP_INSTANCE_UID: 0x00_02_00_03,
	TRANSFER_SYNTAX_UID: 0x00_02_00_10,
	IMPLEMENTATION_CLASS_UID: 0x00_02_00_12,
	SOP_CLASS_UID: 0x00_08_00_16,
	SOP_INSTANCE_UID: 0x00_08_00_18,
	PATIENT_ID: 0x00_10_00_20,
	PIXEL_DATA: 0x7f_e0_00_10,
} as const

const ITEM_TAG = 0xff_fe_e0_00
const SEQUENCE_DELIMITATION_TAG = 0xff_fe_e0_dd
const UNDEFINED_LENGTH = 0xff_ff_ff_ff
const PART10_PREAMBLE_LENGTH = 128
const PART10_PREFIX = "DICM"
const FILE_META_INFORMATION_VERSION = Buffer.from([0, 1])
const LONG_LENGTH_VRS = ["OB", "OW", "SQ", "UN", "UT"]
const SHORT_ELEMENT_HEADER_LENGTH = 8
const LONG_ELEMENT_HEADER_LENGTH = 12
const LONG_LENGTH_OFFSET = 8
const SHORT_LENGTH_OFFSET = 6
const ITEM_HEADER_LENGTH = 8
const ITEM_LENGTH_OFFSET = 4
const GROUP_LENGTH_BYTES = 4
const UID_PADDING = "\0"
const TEXT_PADDING = " "
const SYNTHETIC_IMAGE_PATIENT_ID = "SYNTHETIC-0001"
const PIXEL_PATTERN_PERIOD = 253

function writeTag(header: Buffer, tag: number): void {
	header.writeUInt16LE(tag >>> 16, 0)
	header.writeUInt16LE(tag & 0xff_ff, 2)
}

function element(tag: number, vr: string, value: Buffer, length = value.length): Buffer {
	const isLong = LONG_LENGTH_VRS.includes(vr)
	const header = Buffer.alloc(isLong ? LONG_ELEMENT_HEADER_LENGTH : SHORT_ELEMENT_HEADER_LENGTH)
	writeTag(header, tag)
	header.write(vr, 4, "latin1")
	if (isLong) {
		header.writeUInt32LE(length, LONG_LENGTH_OFFSET)
	} else {
		header.writeUInt16LE(length, SHORT_LENGTH_OFFSET)
	}
	return Buffer.concat([header, value])
}

function item(tag: number, value: Buffer): Buffer {
	const header = Buffer.alloc(ITEM_HEADER_LENGTH)
	writeTag(header, tag)
	header.writeUInt32LE(value.length, ITEM_LENGTH_OFFSET)
	return Buffer.concat([header, value])
}

function padded(value: string, padding: string): Buffer {
	return Buffer.from(value.length % 2 === 0 ? value : `${value}${padding}`, "latin1")
}

// ADR-017
function pixelData(transferSyntaxUid: string, pixels: Buffer): Buffer {
	if (transferSyntaxUid !== JPEG_BASELINE) {
		return element(TAG.PIXEL_DATA, "OB", pixels)
	}
	const basicOffsetTable = item(ITEM_TAG, Buffer.alloc(0))
	const fragment = item(ITEM_TAG, pixels)
	const delimiter = item(SEQUENCE_DELIMITATION_TAG, Buffer.alloc(0))
	return element(TAG.PIXEL_DATA, "OB", Buffer.concat([basicOffsetTable, fragment, delimiter]), UNDEFINED_LENGTH)
}

export interface Part10Content {
	sopClassUid: string
	sopInstanceUid: string
	transferSyntaxUid: string
	patientId: string
	pixels: Buffer
}

export function part10Bytes(content: Part10Content): Buffer {
	const metaElements = Buffer.concat([
		element(TAG.FILE_META_INFORMATION_VERSION, "OB", FILE_META_INFORMATION_VERSION),
		element(TAG.MEDIA_STORAGE_SOP_CLASS_UID, "UI", padded(content.sopClassUid, UID_PADDING)),
		element(TAG.MEDIA_STORAGE_SOP_INSTANCE_UID, "UI", padded(content.sopInstanceUid, UID_PADDING)),
		element(TAG.TRANSFER_SYNTAX_UID, "UI", padded(content.transferSyntaxUid, UID_PADDING)),
		element(TAG.IMPLEMENTATION_CLASS_UID, "UI", padded(CLIENT_IMPLEMENTATION_CLASS_UID, UID_PADDING)),
	])
	const groupLength = Buffer.alloc(GROUP_LENGTH_BYTES)
	groupLength.writeUInt32LE(metaElements.length)
	return Buffer.concat([
		Buffer.alloc(PART10_PREAMBLE_LENGTH),
		Buffer.from(PART10_PREFIX, "latin1"),
		element(TAG.FILE_META_INFORMATION_GROUP_LENGTH, "UL", groupLength),
		metaElements,
		element(TAG.SOP_CLASS_UID, "UI", padded(content.sopClassUid, UID_PADDING)),
		element(TAG.SOP_INSTANCE_UID, "UI", padded(content.sopInstanceUid, UID_PADDING)),
		element(TAG.PATIENT_ID, "LO", padded(content.patientId, TEXT_PADDING)),
		pixelData(content.transferSyntaxUid, content.pixels),
	])
}

function patternedPixels(pixelBytes: number): Buffer {
	const pixels = Buffer.alloc(pixelBytes)
	for (let index = 0; index < pixelBytes; index += 1) {
		pixels[index] = index % PIXEL_PATTERN_PERIOD
	}
	return pixels
}

export function syntheticPart10(
	transferSyntaxUid: string,
	pixelBytes: number,
	sopInstanceUid = Dataset.generateDerivedUid(),
): Buffer {
	return part10Bytes({
		sopClassUid: SECONDARY_CAPTURE_IMAGE_STORAGE,
		sopInstanceUid,
		transferSyntaxUid,
		patientId: SYNTHETIC_IMAGE_PATIENT_ID,
		pixels: patternedPixels(pixelBytes),
	})
}

export function syntheticImage(transferSyntaxUid: string, pixelBytes: number, sopInstanceUid?: string): Dataset {
	return Dataset.fromStoredPart10(syntheticPart10(transferSyntaxUid, pixelBytes, sopInstanceUid))
}
