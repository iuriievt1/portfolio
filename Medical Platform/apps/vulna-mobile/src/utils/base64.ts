export const JPEG_DATA_URI = "data:image/jpeg;base64,"
const CHUNK_BYTES = 0x80_00

export const BITS_PER_BYTE = 8
export const BITS_PER_CHARACTER = 6

// RFC 4648 4
export function base64Of(bytes: Uint8Array): string {
	let binary = ""
	for (let start = 0; start < bytes.length; start += CHUNK_BYTES) {
		binary += String.fromCharCode(...bytes.subarray(start, start + CHUNK_BYTES))
	}
	return btoa(binary)
}

// ADR-026
export function jpegDataUriOf(bytes: Uint8Array): string {
	return `${JPEG_DATA_URI}${base64Of(bytes)}`
}
