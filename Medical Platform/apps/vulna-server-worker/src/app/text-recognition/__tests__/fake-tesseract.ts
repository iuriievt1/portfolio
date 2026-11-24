import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
	ISOLATION_FAILED_EXIT,
	MODEL_FILE_SUFFIX,
	RECOGNITION_LANGUAGES,
	SANDBOX_SEPARATOR,
	START_FAILED_EXIT,
	STDERR_TAIL_BYTES,
} from "../constants/text-recognition.constants"

const EXECUTABLE_MODE = 0o755
const PROBE_FAILURE_EXIT = 3
const SLEEPER_REPORT_FILE = "sleeper.json"
const SANDBOX_REPORT_FILE = "sandbox.json"
const ENGLISH = "eng"

// CAP-022-R05
const PDF_BUILDER = `
function pdfOf(pageCount, comment) {
	const pages = Array.from({ length: pageCount }, (_, index) =>
		(10 + index) + " 0 obj\\n<<\\n  /Type /Page\\n  /Resources << /Font << /f-0-0 3 0 R >> >>\\n>>\\nendobj\\n").join("")
	return "%PDF-1.5\\n%" + comment + "\\n3 0 obj\\n<<\\n  /BaseFont /GlyphLessFont\\n  /Type /Font\\n>>\\nendobj\\n" + pages + "%%EOF\\n"
}
function listedPages() {
	return fs.readFileSync("pages.txt", "utf8").split("\\n").filter((line) => line !== "")
}
`

// backend.md 5, NAB-465
const PROBE = `
const macosProcessVariables = ["__CF_USER_TEXT_ENCODING"]
const allowed = process.platform === "darwin" ? macosProcessVariables : []
const problems = []
const foreign = Object.keys(process.env).filter((name) => !allowed.includes(name))
if (foreign.length > 0) problems.push("the environment holds " + foreign.join(", "))
const listed = listedPages()
const entries = fs.readdirSync(".").sort()
const expected = ["pages.txt", ...listed].sort()
if (JSON.stringify(entries) !== JSON.stringify(expected)) problems.push("the working directory holds " + entries.join(", "))
if (problems.length > 0) {
	process.stderr.write(problems.join("; "))
	process.exit(${PROBE_FAILURE_EXIT})
}
const report = {
	workingDirectory: process.cwd(),
	arguments: process.argv.slice(2),
	pages: listed.map((file) => fs.readFileSync(file, "utf8")),
}
fs.writeFileSync(process.argv[3] + ".pdf", pdfOf(listed.length, JSON.stringify(report)))
`

// ADR-005
const SANDBOX = `
const separator = process.argv.indexOf("${SANDBOX_SEPARATOR}", 2)
fs.writeFileSync(path.join(__dirname, "${SANDBOX_REPORT_FILE}"), JSON.stringify(process.argv.slice(2, separator)))
const program = process.argv[separator + 1]
try {
	fs.accessSync(program, fs.constants.X_OK)
} catch (error) {
	process.stderr.write("ocr-sandbox: cannot start " + program + ": " + error.message)
	process.exit(${START_FAILED_EXIT})
}
process.removeAllListeners("warning")
process.execve(program, process.argv.slice(separator + 1), process.env)
`

const REFUSING_SANDBOX = `
process.stderr.write("ocr-sandbox: cannot use landlock: Function not implemented")
process.exit(${ISOLATION_FAILED_EXIT})
`

const SLEEPER = `
process.on("SIGTERM", () => {})
fs.writeFileSync(path.join(__dirname, "${SLEEPER_REPORT_FILE}"), JSON.stringify({ pid: process.pid, workingDirectory: process.cwd() }))
setInterval(() => {}, 1000)
`

const CRASHER = `
fs.writeFileSync(process.argv[3] + ".pdf", pdfOf(1, "half"))
process.stderr.write("x".repeat(${STDERR_TAIL_BYTES * 2}) + "\\nError during processing.\\n")
process.exitCode = 1
`

const LIAR = `
fs.writeFileSync(process.argv[3] + ".pdf", "Error during processing.")
`

const PAGE_LOSER = `
fs.writeFileSync(process.argv[3] + ".pdf", pdfOf(listedPages().length - 1, "short"))
`

const SILENT = `
`

const MEMORY_HOG = `
const chunks = []
for (let index = 0; index < 8; index++) chunks.push(Buffer.alloc(64 * 1024 * 1024, 1))
setInterval(() => chunks.length, 1000)
`

export interface ProbeReport {
	workingDirectory: string
	arguments: string[]
	pages: string[]
}

export interface SleeperReport {
	pid: number
	workingDirectory: string
}

// ADR-018
export class FakeTesseract {
	readonly directory = mkdtempSync(join(tmpdir(), "fake-tesseract-"))
	readonly tessdataPath = join(this.directory, "tessdata")
	readonly englishOnlyTessdataPath = join(this.directory, "tessdata-eng")
	readonly sandbox = this.executable("sandbox", SANDBOX)
	readonly refusingSandbox = this.executable("refusing-sandbox", REFUSING_SANDBOX)
	readonly probe = this.executable("probe", PROBE)
	readonly sleeper = this.executable("sleeper", SLEEPER)
	readonly crasher = this.executable("crasher", CRASHER)
	readonly liar = this.executable("liar", LIAR)
	readonly pageLoser = this.executable("page-loser", PAGE_LOSER)
	readonly silent = this.executable("silent", SILENT)
	readonly memoryHog = this.executable("memory-hog", MEMORY_HOG)
	readonly sleeperReportPath = join(this.directory, SLEEPER_REPORT_FILE)
	readonly sandboxReportPath = join(this.directory, SANDBOX_REPORT_FILE)

	constructor() {
		this.writeModels(this.tessdataPath, RECOGNITION_LANGUAGES)
		this.writeModels(this.englishOnlyTessdataPath, [ENGLISH])
	}

	remove(): void {
		rmSync(this.directory, { recursive: true, force: true })
	}

	private writeModels(directory: string, languages: readonly string[]): void {
		mkdirSync(directory)
		for (const language of languages) {
			writeFileSync(join(directory, `${language}${MODEL_FILE_SUFFIX}`), "model")
		}
	}

	private executable(name: string, body: string): string {
		const path = join(this.directory, `${name}.cjs`)
		writeFileSync(
			path,
			`#!${process.execPath}\nconst fs = require("node:fs")\nconst path = require("node:path")\n${PDF_BUILDER}${body}`,
		)
		chmodSync(path, EXECUTABLE_MODE)
		return path
	}
}

export function probeReportOf(pdf: Buffer): ProbeReport {
	const comment = pdf.toString("utf8").split("\n")[1]
	if (comment === undefined) {
		throw new Error("the PDF carries no probe report")
	}
	return JSON.parse(comment.slice(1)) as ProbeReport
}
