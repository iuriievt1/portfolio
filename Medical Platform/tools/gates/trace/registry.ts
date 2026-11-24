export interface Requirement {
	id: string
	sentence: string
	source: string
	version: string
}

const ROW = /^\| ((?:TS|NAB|SML)-\d{3}) \|/
const SENTENCE = 2
const SOURCE = 3
const VERSION = 7

export function parseRegistry(markdown: string): Requirement[] {
	const requirements: Requirement[] = []
	for (const line of markdown.split("\n")) {
		const match = ROW.exec(line)
		if (match?.[1] === undefined) {
			continue
		}
		const cells = line.split("|").map((cell) => cell.trim())
		requirements.push({
			id: match[1],
			sentence: cells[SENTENCE] ?? "",
			source: cells[SOURCE] ?? "",
			version: cells[VERSION] ?? "",
		})
	}
	return requirements
}
