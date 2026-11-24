// DICOM PS3.10 7.1, PS3.5 7.1, 7.5, A.4

export interface ReadElement {
	tag: number
	vr: string | undefined
	value: Buffer
	items: ReadElement[][] | undefined
	fragments: Buffer[] | undefined
}

export interface ReadPart10 {
	preamble: Buffer
	prefix: string
	meta: ReadElement[]
	dataset: ReadElement[]
	datasetOffset: number
}

const PREAMBLE_BYTES = 128
const PREFIX_BYTES = 4
const GROUP_LENGTH_ELEMENT_BYTES = 12
const UNDEFINED_LENGTH = 0xff_ff_ff_ff
const ITEM = 0xff_fe_e0_00
const ITEM_DELIMITATION = 0xff_fe_e0_0d
const SEQUENCE_DELIMITATION = 0xff_fe_e0_dd
const PIXEL_DATA = 0x7f_e0_00_10
const TRANSFER_SYNTAX_UID = 0x00_02_00_10
const META_GROUP = 0x00_02
const IMPLICIT_VR_LITTLE_ENDIAN = "1.2.840.10008.1.2"
const LONG_VRS = new Set(["OB", "OD", "OF", "OL", "OV", "OW", "SQ", "SV", "UC", "UN", "UR", "UT", "UV"])

class Cursor {
	constructor(
		readonly bytes: Buffer,
		public offset: number,
		readonly end: number,
	) {}

	get isDone(): boolean {
		return this.offset >= this.end
	}

	tag(): number {
		const group = this.uint16()
		return ((group << 16) | this.uint16()) >>> 0
	}

	uint16(): number {
		const value = this.bytes.readUInt16LE(this.offset)
		this.offset += 2
		return value
	}

	uint32(): number {
		const value = this.bytes.readUInt32LE(this.offset)
		this.offset += 4
		return value
	}

	take(length: number): Buffer {
		if (this.offset + length > this.end) {
			throw new Error(`a value of ${length} bytes runs past the end at ${this.offset}`)
		}
		const value = this.bytes.subarray(this.offset, this.offset + length)
		this.offset += length
		return value
	}
}

// DICOM PS3.5 7.1.1, 7.1.2, 7.1.3
function lengthOf(cursor: Cursor, vr: string | undefined): number {
	if (vr === undefined) {
		return cursor.uint32()
	}
	if (!LONG_VRS.has(vr)) {
		return cursor.uint16()
	}
	cursor.uint16()
	return cursor.uint32()
}

function readItems(cursor: Cursor, length: number, isExplicit: boolean): ReadElement[][] {
	const end = length === UNDEFINED_LENGTH ? cursor.end : cursor.offset + length
	const items: ReadElement[][] = []
	while (cursor.offset < end) {
		const tag = cursor.tag()
		const itemLength = cursor.uint32()
		if (tag === SEQUENCE_DELIMITATION) {
			return items
		}
		if (tag !== ITEM) {
			throw new Error(`expected an item, found ${tag.toString(16)}`)
		}
		const itemEnd = itemLength === UNDEFINED_LENGTH ? cursor.end : cursor.offset + itemLength
		const item = new Cursor(cursor.bytes, cursor.offset, itemEnd)
		items.push(readElements(item, isExplicit))
		cursor.offset = item.offset
	}
	if (length === UNDEFINED_LENGTH) {
		throw new Error("a sequence of undefined length has no delimitation")
	}
	return items
}

function readFragments(cursor: Cursor): Buffer[] {
	const fragments: Buffer[] = []
	for (;;) {
		const tag = cursor.tag()
		const length = cursor.uint32()
		if (tag === SEQUENCE_DELIMITATION) {
			return fragments
		}
		if (tag !== ITEM) {
			throw new Error(`expected a fragment, found ${tag.toString(16)}`)
		}
		fragments.push(cursor.take(length))
	}
}

function readElements(cursor: Cursor, isExplicit: boolean): ReadElement[] {
	const elements: ReadElement[] = []
	while (!cursor.isDone) {
		const tag = cursor.tag()
		if (tag === ITEM_DELIMITATION) {
			cursor.uint32()
			return elements
		}
		const vr = isExplicit || tag >>> 16 === META_GROUP ? cursor.take(2).toString("latin1") : undefined
		const length = lengthOf(cursor, vr)
		const element: ReadElement = { tag, vr, value: Buffer.alloc(0), items: undefined, fragments: undefined }
		if (tag === PIXEL_DATA && length === UNDEFINED_LENGTH) {
			element.fragments = readFragments(cursor)
		} else if (vr === "SQ" || (vr === undefined && length === UNDEFINED_LENGTH)) {
			element.items = readItems(cursor, length, isExplicit)
		} else {
			element.value = cursor.take(length)
		}
		elements.push(element)
	}
	return elements
}

export function find(elements: readonly ReadElement[], tag: number): ReadElement | undefined {
	return elements.find((element) => element.tag === tag)
}

export function textOf(element: ReadElement | undefined): string | undefined {
	return element === undefined ? undefined : element.value.toString("utf8").replace(/[\0 ]$/, "")
}

export function readPart10(bytes: Buffer): ReadPart10 {
	const metaStart = PREAMBLE_BYTES + PREFIX_BYTES
	const [groupLength] = readElements(new Cursor(bytes, metaStart, metaStart + GROUP_LENGTH_ELEMENT_BYTES), true)
	const datasetOffset = metaStart + GROUP_LENGTH_ELEMENT_BYTES + (groupLength?.value.readUInt32LE(0) ?? 0)
	const meta = readElements(new Cursor(bytes, metaStart, datasetOffset), true)
	const isExplicit = textOf(find(meta, TRANSFER_SYNTAX_UID)) !== IMPLICIT_VR_LITTLE_ENDIAN
	return {
		preamble: bytes.subarray(0, PREAMBLE_BYTES),
		prefix: bytes.toString("latin1", PREAMBLE_BYTES, metaStart),
		meta,
		dataset: readElements(new Cursor(bytes, datasetOffset, bytes.length), isExplicit),
		datasetOffset,
	}
}

export function isAscending(elements: readonly ReadElement[]): boolean {
	return elements.every(
		(element, index) =>
			(index === 0 || (elements[index - 1]?.tag ?? 0) < element.tag) &&
			(element.items ?? []).every((item) => isAscending(item)),
	)
}

export function hasEvenLengths(elements: readonly ReadElement[]): boolean {
	return elements.every(
		(element) =>
			element.value.length % 2 === 0 &&
			(element.fragments ?? []).every((fragment) => fragment.length % 2 === 0) &&
			(element.items ?? []).every((item) => hasEvenLengths(item)),
	)
}
