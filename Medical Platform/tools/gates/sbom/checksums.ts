const CHECKSUM_LINE = /^([0-9a-f]{64}) {2}(\S.*)$/

// ADR-011 ř. 46, ADR-011 ř. 49
export function checksumsOf(text: string): Map<string, string> {
	const checksums = new Map<string, string>()
	for (const line of text.split("\n").filter((candidate) => candidate !== "")) {
		const [, sha256, file] = CHECKSUM_LINE.exec(line) ?? []
		if (sha256 === undefined || file === undefined) {
			throw new Error(`not a sha256sum line: ${line}`)
		}
		checksums.set(file, sha256)
	}
	return checksums
}
