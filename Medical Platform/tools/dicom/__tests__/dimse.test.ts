import { describe, expect, it } from "vitest"
import {
	COMMAND_FIELD,
	DATA_SET_ABSENT,
	DimseFormatError,
	decodeCommand,
	elementHeader,
	emptyCommand,
	encodeCommand,
	encodeElement,
	nestedSequences,
} from "../dimse"
import { ENCAPSULATED_PDF_STORAGE, VERIFICATION } from "../uids"

// PS3.7 E.1, PS3.5 7.1.3, 7.5

const GROUP_LENGTH_VALUE_OFFSET = 8
const GROUP_LENGTH_ELEMENT_LENGTH = 12
const ELEMENT_HEADER_LENGTH = 8
const UNDEFINED_LENGTH = 0xff_ff_ff_ff
const ITEM_TAG = 0xff_fe_e0_00
const ITEM_DELIMITATION_TAG = 0xff_fe_e0_0d
const SEQUENCE_DELIMITATION_TAG = 0xff_fe_e0_dd
const SCHEDULED_PROCEDURE_STEP_SEQUENCE = 0x00_40_01_00
const MESSAGE_ID_TAG = 0x00_00_01_10
const ERROR_COMMENT_TAG = 0x00_00_09_02

function tagsOf(bytes: Buffer): number[] {
	const tags: number[] = []
	for (let offset = 0; offset < bytes.length; offset += ELEMENT_HEADER_LENGTH + bytes.readUInt32LE(offset + 4)) {
		tags.push(bytes.readUInt16LE(offset) * 0x1_00_00 + bytes.readUInt16LE(offset + 2))
	}
	return tags
}

describe("DIMSE command set PS3.7 E.1", () => {
	it("reads back a C-STORE-RSP it wrote", () => {
		const command = {
			...emptyCommand(COMMAND_FIELD.C_STORE_RSP),
			messageIdBeingRespondedTo: 7,
			affectedSopClassUid: ENCAPSULATED_PDF_STORAGE,
			affectedSopInstanceUid: "2.25.123",
			status: 0xa7_00,
		}

		expect(decodeCommand(encodeCommand(command))).toEqual(command)
	})

	it("writes the group length of the elements that follow it", () => {
		const bytes = encodeCommand({ ...emptyCommand(COMMAND_FIELD.C_ECHO_RQ), messageId: 1 })

		expect(bytes.readUInt32LE(GROUP_LENGTH_VALUE_OFFSET)).toBe(bytes.length - GROUP_LENGTH_ELEMENT_LENGTH)
	})

	it("PS3.5 9.1 pads an odd UID with a null byte and reads it back without it", () => {
		const bytes = encodeCommand({ ...emptyCommand(COMMAND_FIELD.C_ECHO_RSP), affectedSopClassUid: VERIFICATION })

		expect(bytes.includes(Buffer.from(`${VERIFICATION}\0`, "ascii"))).toBe(true)
		expect(decodeCommand(bytes).affectedSopClassUid).toBe(VERIFICATION)
	})

	it("refuses an element that runs past the command set", () => {
		const bytes = encodeCommand(emptyCommand(COMMAND_FIELD.C_ECHO_RQ))
		const truncated = Buffer.concat([bytes, encodeElement(ERROR_COMMENT_TAG, Buffer.alloc(4)).subarray(0, 10)])

		expect(() => decodeCommand(truncated)).toThrow(DimseFormatError)
	})

	it("refuses a command set without a command field", () => {
		expect(() => decodeCommand(encodeElement(MESSAGE_ID_TAG, Buffer.from([1, 0])))).toThrow(DimseFormatError)
	})

	it("refuses an unsigned short element that is not two bytes", () => {
		const bytes = Buffer.concat([
			encodeCommand(emptyCommand(COMMAND_FIELD.C_ECHO_RQ)),
			encodeElement(MESSAGE_ID_TAG, Buffer.from([1, 0, 0])),
		])

		expect(() => decodeCommand(bytes)).toThrow("has 3 bytes, expected 2")
	})

	it("PS3.7 E.1 writes the command elements in ascending tag order", () => {
		const bytes = encodeCommand({
			...emptyCommand(COMMAND_FIELD.C_STORE_RSP),
			messageId: 1,
			messageIdBeingRespondedTo: 1,
			priority: 0,
			affectedSopClassUid: ENCAPSULATED_PDF_STORAGE,
			affectedSopInstanceUid: "2.25.1",
			status: 0,
			dataSetType: DATA_SET_ABSENT,
		})
		const tags = tagsOf(bytes)

		expect(tags).toEqual([...tags].sort((a, b) => a - b))
		expect(tags).toHaveLength(9)
	})

	it("PS3.5 7.5 nests sequences of undefined length with all delimiters", () => {
		expect(nestedSequences(SCHEDULED_PROCEDURE_STEP_SEQUENCE, 1)).toEqual(
			Buffer.concat([
				elementHeader(SCHEDULED_PROCEDURE_STEP_SEQUENCE, UNDEFINED_LENGTH),
				elementHeader(ITEM_TAG, UNDEFINED_LENGTH),
				elementHeader(ITEM_DELIMITATION_TAG, 0),
				elementHeader(SEQUENCE_DELIMITATION_TAG, 0),
			]),
		)
		expect(nestedSequences(SCHEDULED_PROCEDURE_STEP_SEQUENCE, 3).subarray(0, ELEMENT_HEADER_LENGTH * 2)).toEqual(
			nestedSequences(SCHEDULED_PROCEDURE_STEP_SEQUENCE, 1).subarray(0, ELEMENT_HEADER_LENGTH * 2),
		)
	})
})
