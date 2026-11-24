// PS3.7 9.3, E.1, PS3.5 7.1.3, 7.5, integrace-dicom.md 8

export const COMMAND_FIELD = {
	C_STORE_RQ: 0x00_01,
	C_STORE_RSP: 0x80_01,
	C_FIND_RQ: 0x00_20,
	C_FIND_RSP: 0x80_20,
	C_ECHO_RQ: 0x00_30,
	C_ECHO_RSP: 0x80_30,
	C_MOVE_RSP: 0x80_21,
	C_CANCEL_RQ: 0x0f_ff,
} as const

export const STATUS = {
	SUCCESS: 0x00_00,
	CANCEL: 0xfe_00,
	PENDING: 0xff_00,
	PENDING_WARNING: 0xff_01,
} as const

export const DATA_SET_ABSENT = 0x01_01
export const DATA_SET_PRESENT = 0x00_00

const TAG = {
	COMMAND_GROUP_LENGTH: 0x00_00_00_00,
	AFFECTED_SOP_CLASS_UID: 0x00_00_00_02,
	COMMAND_FIELD: 0x00_00_01_00,
	MESSAGE_ID: 0x00_00_01_10,
	MESSAGE_ID_BEING_RESPONDED_TO: 0x00_00_01_20,
	PRIORITY: 0x00_00_07_00,
	COMMAND_DATA_SET_TYPE: 0x00_00_08_00,
	STATUS: 0x00_00_09_00,
	AFFECTED_SOP_INSTANCE_UID: 0x00_00_10_00,
} as const

const ELEMENT_HEADER_LENGTH = 8
const UNSIGNED_SHORT_LENGTH = 2
const UNSIGNED_LONG_LENGTH = 4
const TAG_GROUP_FACTOR = 0x1_00_00
const TAG_DIGITS = 8
const UNDEFINED_LENGTH = 0xff_ff_ff_ff
const ITEM_TAG = 0xff_fe_e0_00
const ITEM_DELIMITATION_TAG = 0xff_fe_e0_0d
const SEQUENCE_DELIMITATION_TAG = 0xff_fe_e0_dd
const UID_PADDING = /\0+$/

export class DimseFormatError extends Error {}

export interface DimseCommand {
	commandField: number
	messageId: number | undefined
	messageIdBeingRespondedTo: number | undefined
	affectedSopClassUid: string | undefined
	affectedSopInstanceUid: string | undefined
	priority: number | undefined
	dataSetType: number
	status: number | undefined
}

export function emptyCommand(commandField: number): DimseCommand {
	return {
		commandField,
		messageId: undefined,
		messageIdBeingRespondedTo: undefined,
		affectedSopClassUid: undefined,
		affectedSopInstanceUid: undefined,
		priority: undefined,
		dataSetType: DATA_SET_ABSENT,
		status: undefined,
	}
}

export function hasDataSet(command: DimseCommand): boolean {
	return command.dataSetType !== DATA_SET_ABSENT
}

// PS3.5 7.1.3
export function elementHeader(tag: number, declaredLength: number): Buffer {
	const header = Buffer.alloc(ELEMENT_HEADER_LENGTH)
	header.writeUInt16LE(tag >>> 16, 0)
	header.writeUInt16LE(tag & 0xff_ff, 2)
	header.writeUInt32LE(declaredLength, 4)
	return header
}

export function encodeElement(tag: number, value: Buffer): Buffer {
	return Buffer.concat([elementHeader(tag, value.length), value])
}

export function uidValue(uid: string): Buffer {
	const bytes = Buffer.from(uid, "ascii")
	return bytes.length % 2 === 0 ? bytes : Buffer.concat([bytes, Buffer.from([0])])
}

export function textValue(text: string, encoding: BufferEncoding = "utf8"): Buffer {
	const bytes = Buffer.from(text, encoding)
	return bytes.length % 2 === 0 ? bytes : Buffer.concat([bytes, Buffer.from(" ", "ascii")])
}

function unsignedShort(value: number): Buffer {
	const bytes = Buffer.alloc(UNSIGNED_SHORT_LENGTH)
	bytes.writeUInt16LE(value, 0)
	return bytes
}

// PS3.5 7.5
export function nestedSequences(tag: number, depth: number): Buffer {
	const open = Buffer.concat([elementHeader(tag, UNDEFINED_LENGTH), elementHeader(ITEM_TAG, UNDEFINED_LENGTH)])
	const close = Buffer.concat([elementHeader(ITEM_DELIMITATION_TAG, 0), elementHeader(SEQUENCE_DELIMITATION_TAG, 0)])
	return Buffer.concat([...Array.from({ length: depth }, () => open), ...Array.from({ length: depth }, () => close)])
}

// PS3.5 7.5
export function encodeSequence(tag: number, items: readonly Buffer[]): Buffer {
	return Buffer.concat([
		elementHeader(tag, UNDEFINED_LENGTH),
		...items.flatMap((item) => [
			elementHeader(ITEM_TAG, UNDEFINED_LENGTH),
			item,
			elementHeader(ITEM_DELIMITATION_TAG, 0),
		]),
		elementHeader(SEQUENCE_DELIMITATION_TAG, 0),
	])
}

export function encodeCommand(command: DimseCommand): Buffer {
	const elements: Buffer[] = []
	if (command.affectedSopClassUid !== undefined) {
		elements.push(encodeElement(TAG.AFFECTED_SOP_CLASS_UID, uidValue(command.affectedSopClassUid)))
	}
	elements.push(encodeElement(TAG.COMMAND_FIELD, unsignedShort(command.commandField)))
	if (command.messageId !== undefined) {
		elements.push(encodeElement(TAG.MESSAGE_ID, unsignedShort(command.messageId)))
	}
	if (command.messageIdBeingRespondedTo !== undefined) {
		elements.push(encodeElement(TAG.MESSAGE_ID_BEING_RESPONDED_TO, unsignedShort(command.messageIdBeingRespondedTo)))
	}
	if (command.priority !== undefined) {
		elements.push(encodeElement(TAG.PRIORITY, unsignedShort(command.priority)))
	}
	elements.push(encodeElement(TAG.COMMAND_DATA_SET_TYPE, unsignedShort(command.dataSetType)))
	if (command.status !== undefined) {
		elements.push(encodeElement(TAG.STATUS, unsignedShort(command.status)))
	}
	if (command.affectedSopInstanceUid !== undefined) {
		elements.push(encodeElement(TAG.AFFECTED_SOP_INSTANCE_UID, uidValue(command.affectedSopInstanceUid)))
	}
	const body = Buffer.concat(elements)
	const groupLength = Buffer.alloc(UNSIGNED_LONG_LENGTH)
	groupLength.writeUInt32LE(body.length, 0)
	return Buffer.concat([encodeElement(TAG.COMMAND_GROUP_LENGTH, groupLength), body])
}

function tagText(tag: number): string {
	return tag.toString(16).padStart(TAG_DIGITS, "0")
}

function readUnsignedShort(tag: number, value: Buffer): number {
	if (value.length !== UNSIGNED_SHORT_LENGTH) {
		throw new DimseFormatError(`element ${tagText(tag)} has ${value.length} bytes, expected ${UNSIGNED_SHORT_LENGTH}`)
	}
	return value.readUInt16LE(0)
}

export function decodeCommand(bytes: Buffer): DimseCommand {
	let commandField: number | undefined
	const command = emptyCommand(0)
	let offset = 0
	while (offset < bytes.length) {
		if (offset + ELEMENT_HEADER_LENGTH > bytes.length) {
			throw new DimseFormatError(`element header at ${offset} runs past ${bytes.length} bytes`)
		}
		const tag = bytes.readUInt16LE(offset) * TAG_GROUP_FACTOR + bytes.readUInt16LE(offset + 2)
		const length = bytes.readUInt32LE(offset + 4)
		const end = offset + ELEMENT_HEADER_LENGTH + length
		if (end > bytes.length) {
			throw new DimseFormatError(`element ${tagText(tag)} declares ${length} bytes past the end`)
		}
		const value = bytes.subarray(offset + ELEMENT_HEADER_LENGTH, end)
		switch (tag) {
			case TAG.AFFECTED_SOP_CLASS_UID:
				command.affectedSopClassUid = value.toString("ascii").replace(UID_PADDING, "")
				break
			case TAG.COMMAND_FIELD:
				commandField = readUnsignedShort(tag, value)
				break
			case TAG.MESSAGE_ID:
				command.messageId = readUnsignedShort(tag, value)
				break
			case TAG.MESSAGE_ID_BEING_RESPONDED_TO:
				command.messageIdBeingRespondedTo = readUnsignedShort(tag, value)
				break
			case TAG.PRIORITY:
				command.priority = readUnsignedShort(tag, value)
				break
			case TAG.COMMAND_DATA_SET_TYPE:
				command.dataSetType = readUnsignedShort(tag, value)
				break
			case TAG.STATUS:
				command.status = readUnsignedShort(tag, value)
				break
			case TAG.AFFECTED_SOP_INSTANCE_UID:
				command.affectedSopInstanceUid = value.toString("ascii").replace(UID_PADDING, "")
				break
			default:
				break
		}
		offset = end
	}
	if (commandField === undefined) {
		throw new DimseFormatError("command set without command field")
	}
	return { ...command, commandField }
}
