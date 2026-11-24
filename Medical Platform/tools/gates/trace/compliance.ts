export type CoverageState = "pokryto" | "mimo chování" | "otevřené"

export interface Coverage {
	id: string
	state: CoverageState
	capability?: string
	home?: string
}

const CHAPTER = /^## (\d+)\./
const OWNED_SECTION = /^### 3\.\d+ (CAP-\d{3}) /
const GROUP_SECTION = /^### 4\.\d+ /
const HOME = /^\*\*Domov:\*\* (.*)$/
const ROW = /^\| ((?:TS|NAB|SML)-\d{3}) \|/
const STATE = 4
const OWNED_CHAPTER = "3"
const NON_BEHAVIOUR_CHAPTER = "4"

export function parseCompliance(markdown: string): Map<string, Coverage> {
	const coverage = new Map<string, Coverage>()
	let chapter = ""
	let capability: string | undefined
	let home: string | undefined

	for (const line of markdown.split("\n")) {
		const chapterMatch = CHAPTER.exec(line)
		if (chapterMatch?.[1] !== undefined) {
			chapter = chapterMatch[1]
			capability = undefined
			home = undefined
			continue
		}
		const owned = OWNED_SECTION.exec(line)
		if (owned?.[1] !== undefined) {
			capability = owned[1]
			continue
		}
		if (GROUP_SECTION.test(line)) {
			home = undefined
			continue
		}
		const homeMatch = HOME.exec(line)
		if (homeMatch?.[1] !== undefined) {
			home = homeMatch[1].trim()
			continue
		}
		const row = ROW.exec(line)
		if (row?.[1] === undefined || (chapter !== OWNED_CHAPTER && chapter !== NON_BEHAVIOUR_CHAPTER)) {
			continue
		}
		const state = (line.split("|")[STATE] ?? "").trim() as CoverageState
		coverage.set(row[1], chapter === OWNED_CHAPTER ? { id: row[1], state, capability } : { id: row[1], state, home })
	}
	return coverage
}
