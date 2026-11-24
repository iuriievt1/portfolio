// CAP-015-R14, CAP-015-S04
export function copiedBytesOf(buffer: ArrayBuffer): Uint8Array {
	return new Uint8Array(buffer).slice()
}
