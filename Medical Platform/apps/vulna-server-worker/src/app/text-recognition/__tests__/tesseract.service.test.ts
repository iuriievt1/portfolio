import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"
import { afterAll, describe, expect, it, vi } from "vitest"
import {
	ATTEMPT_DIRECTORY_PREFIX,
	STDERR_TAIL_BYTES,
	SYSTEM_LIBRARY_PATH,
	TEXT_RECOGNITION_FAILURE,
} from "../constants/text-recognition.constants"
import { TextRecognitionError } from "../errors/text-recognition.error"
import { TesseractService } from "../services/tesseract.service"
import type { PageReader, TextRecognitionFailure, TextRecognitionSettings } from "../types/text-recognition.types"
import { FakeTesseract, probeReportOf, type SleeperReport } from "./fake-tesseract"

const fake = new FakeTesseract()
const PAGES = ["first page", "second page", "third page"]
const TITLE = "Propouštěcí zpráva = vzor"
const TIMEOUT_MILLISECONDS = 10_000
const SHORT_TIMEOUT_MILLISECONDS = 2000
const MEMORY_LIMIT_BYTES = 1024 * 1024 * 1024
const SMALL_MEMORY_LIMIT_BYTES = 200 * 1024 * 1024
const SECRET_VARIABLE = "DATABASE_URL_WORKER"
const SECRET = "postgres://vulna_worker:secret@database/vulna"
const UNREADABLE_PAGE = "the buffer holds no page"

afterAll(() => {
	fake.remove()
})

function readersOf(pages: readonly string[]): PageReader[] {
	return pages.map((page) => async () => Buffer.from(page))
}

function settingsOf(tesseractPath: string, overrides: Partial<TextRecognitionSettings> = {}): TextRecognitionSettings {
	return {
		sandboxPath: fake.sandbox,
		tesseractPath,
		tessdataPath: fake.tessdataPath,
		timeoutMilliseconds: TIMEOUT_MILLISECONDS,
		memoryLimitBytes: MEMORY_LIMIT_BYTES,
		...overrides,
	}
}

async function failureOf(work: Promise<unknown>): Promise<TextRecognitionError> {
	const error = await work.then(
		() => undefined,
		(reason: unknown) => reason,
	)
	if (!(error instanceof TextRecognitionError)) {
		throw new Error(`expected a text recognition error, got ${String(error)}`)
	}
	return error
}

function expectFailure(error: TextRecognitionError, failure: TextRecognitionFailure): void {
	expect(error.failure, error.message).toBe(failure)
}

function attemptDirectories(): string[] {
	return readdirSync(tmpdir()).filter((name) => name.startsWith(ATTEMPT_DIRECTORY_PREFIX))
}

describe("TesseractService", () => {
	const service = new TesseractService()

	it("CAP-022-R05 runs the tool once over all pages in order and returns one PDF", async () => {
		const pdf = await service.pdfOf(readersOf(PAGES), TITLE, settingsOf(fake.probe))

		expect(probeReportOf(pdf).pages).toEqual(PAGES)
		expect(pdf.toString("latin1").match(/\/Type \/Page\n/g)).toHaveLength(PAGES.length)
	})

	it("ADR-005 runs the tool in the sandbox that sees only its attempt, the models, the tool and the libraries", async () => {
		const report = probeReportOf(await service.pdfOf(readersOf(PAGES), TITLE, settingsOf(fake.probe)))

		expect(JSON.parse(readFileSync(fake.sandboxReportPath, "utf8"))).toEqual([
			"--write",
			join(tmpdir(), basename(report.workingDirectory)),
			"--read",
			fake.tessdataPath,
			"--execute",
			fake.probe,
			"--execute",
			SYSTEM_LIBRARY_PATH,
		])
	})

	it("ADR-005 refuses to recognize when the sandbox cannot isolate the tool", async () => {
		const error = await failureOf(
			service.pdfOf(readersOf(PAGES), TITLE, settingsOf(fake.probe, { sandboxPath: fake.refusingSandbox })),
		)

		expectFailure(error, TEXT_RECOGNITION_FAILURE.ISOLATION_FAILED)
		expect(error.message).toContain("cannot use landlock")
	})

	it("ADR-005 reports a sandbox that does not start", async () => {
		const error = await failureOf(
			service.pdfOf(
				readersOf(PAGES),
				TITLE,
				settingsOf(fake.probe, { sandboxPath: join(fake.directory, "missing-sandbox") }),
			),
		)

		expectFailure(error, TEXT_RECOGNITION_FAILURE.START_FAILED)
	})

	it("CAP-022-R03 asks for Czech and English from the fixed model path, CAP-022-R16 with the title as one argument", async () => {
		const report = probeReportOf(await service.pdfOf(readersOf(PAGES), TITLE, settingsOf(fake.probe)))

		expect(report.arguments).toEqual([
			"pages.txt",
			"document",
			"--tessdata-dir",
			fake.tessdataPath,
			"-l",
			"ces+eng",
			"-c",
			"tessedit_create_pdf=1",
			"-c",
			`document_title=${TITLE}`,
		])
	})

	it("backend.md 5 hands the tool an empty environment and a directory with only the files of its attempt", async () => {
		process.env[SECRET_VARIABLE] = SECRET
		try {
			await expect(service.pdfOf(readersOf(PAGES), TITLE, settingsOf(fake.probe))).resolves.toBeInstanceOf(Buffer)
		} finally {
			delete process.env[SECRET_VARIABLE]
		}
	})

	it("backend.md 5 removes the files of the attempt once the PDF is out", async () => {
		const report = probeReportOf(await service.pdfOf(readersOf(PAGES), TITLE, settingsOf(fake.probe)))

		expect(existsSync(report.workingDirectory)).toBe(false)
	})

	it("backend.md 5 removes the files of the attempt when a page cannot be read", async () => {
		const unreadable: PageReader = async () => {
			throw new Error(UNREADABLE_PAGE)
		}
		const before = attemptDirectories()

		await expect(service.pdfOf([...readersOf(PAGES), unreadable], TITLE, settingsOf(fake.probe))).rejects.toThrow(
			UNREADABLE_PAGE,
		)
		expect(attemptDirectories()).toEqual(before)
	})

	it("backend.md 5 removes the attempts an earlier run left behind when the worker starts", async () => {
		const leftover = join(tmpdir(), `${ATTEMPT_DIRECTORY_PREFIX}leftover`)
		mkdirSync(leftover, { recursive: true })

		await service.onModuleInit()

		expect(existsSync(leftover)).toBe(false)
	})

	it("CAP-022-R02 leaves no timer of the attempt behind", async () => {
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] })
		try {
			await service.pdfOf(readersOf(PAGES), TITLE, settingsOf(fake.probe))

			expect(vi.getTimerCount()).toBe(0)
		} finally {
			vi.useRealTimers()
		}
	})

	it("CAP-022-R05 refuses to recognize a document without pages", async () => {
		await expect(service.pdfOf([], TITLE, settingsOf(fake.probe))).rejects.toThrow("at least one page")
	})

	it("CAP-022-R02 kills the tool when the time limit runs out and removes its files", async () => {
		rmSync(fake.sleeperReportPath, { force: true })
		const error = await failureOf(
			service.pdfOf(
				readersOf(PAGES),
				TITLE,
				settingsOf(fake.sleeper, { timeoutMilliseconds: SHORT_TIMEOUT_MILLISECONDS }),
			),
		)

		expectFailure(error, TEXT_RECOGNITION_FAILURE.TIMED_OUT)
		const sleeper = JSON.parse(readFileSync(fake.sleeperReportPath, "utf8")) as SleeperReport
		expect(() => process.kill(sleeper.pid, 0)).toThrow()
		expect(existsSync(sleeper.workingDirectory)).toBe(false)
	})

	it("CAP-022-R10 reports a crash of the tool with the end of what it wrote, even when it left part of a PDF", async () => {
		const error = await failureOf(service.pdfOf(readersOf(PAGES), TITLE, settingsOf(fake.crasher)))

		expectFailure(error, TEXT_RECOGNITION_FAILURE.CRASHED)
		expect(error.message).toContain("Error during processing.")
		expect(error.message).not.toContain("x".repeat(STDERR_TAIL_BYTES))
	})

	it("ADR-018 refuses output that is not a PDF", async () => {
		const error = await failureOf(service.pdfOf(readersOf(PAGES), TITLE, settingsOf(fake.liar)))

		expectFailure(error, TEXT_RECOGNITION_FAILURE.INVALID_OUTPUT)
	})

	it("CAP-022-R05 refuses a PDF that lost a page", async () => {
		const error = await failureOf(service.pdfOf(readersOf(PAGES), TITLE, settingsOf(fake.pageLoser)))

		expectFailure(error, TEXT_RECOGNITION_FAILURE.INVALID_OUTPUT)
	})

	it("ADR-018 refuses a run that wrote no PDF", async () => {
		const error = await failureOf(service.pdfOf(readersOf(PAGES), TITLE, settingsOf(fake.silent)))

		expectFailure(error, TEXT_RECOGNITION_FAILURE.INVALID_OUTPUT)
	})

	it("CAP-022-R03 refuses to recognize without the Czech model", async () => {
		const error = await failureOf(
			service.pdfOf(readersOf(PAGES), TITLE, settingsOf(fake.probe, { tessdataPath: fake.englishOnlyTessdataPath })),
		)

		expectFailure(error, TEXT_RECOGNITION_FAILURE.MODELS_MISSING)
	})

	it("ADR-018 reports a tool that does not start", async () => {
		const error = await failureOf(
			service.pdfOf(readersOf(PAGES), TITLE, settingsOf(join(fake.directory, "missing-tesseract"))),
		)

		expectFailure(error, TEXT_RECOGNITION_FAILURE.START_FAILED)
	})

	it.runIf(process.platform === "linux")("CAP-022-R02 stops the tool when it goes over the memory limit", async () => {
		const error = await failureOf(
			service.pdfOf(
				readersOf(PAGES),
				TITLE,
				settingsOf(fake.memoryHog, { memoryLimitBytes: SMALL_MEMORY_LIMIT_BYTES }),
			),
		)

		expectFailure(error, TEXT_RECOGNITION_FAILURE.MEMORY_EXCEEDED)
	})
})
