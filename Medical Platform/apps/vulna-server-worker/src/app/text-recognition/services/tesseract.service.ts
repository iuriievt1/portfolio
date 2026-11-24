import { type ChildProcess, spawn } from "node:child_process"
import { constants, readFileSync } from "node:fs"
import { access, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common"
import {
	ATTEMPT_DIRECTORY_PREFIX,
	ISOLATION_FAILED_EXIT,
	KILL_SIGNAL,
	MEMORY_CHECK_INTERVAL_MILLISECONDS,
	MODEL_FILE_SUFFIX,
	NEW_FILE_FLAG,
	OUTPUT_FILE,
	PAGE_LIST_FILE,
	PRIVATE_FILE_MODE,
	PROCESS_STATUS_PLATFORM,
	RECOGNITION_LANGUAGES,
	START_FAILED_EXIT,
	STDERR_TAIL_BYTES,
	SUBPROCESS_ENVIRONMENT,
	SUCCESSFUL_EXIT,
	TEXT_RECOGNITION_FAILURE,
} from "../constants/text-recognition.constants"
import { TextRecognitionError } from "../errors/text-recognition.error"
import type { PageReader, TextRecognitionFailure, TextRecognitionSettings } from "../types/text-recognition.types"
import { pdfProblemOf } from "../utils/pdf-output"
import { peakResidentBytesOf, processStatusPathOf } from "../utils/process-status"
import { pageFileOf, pageListOf, sandboxedArgumentsOf } from "../utils/tesseract-arguments"

function hasEnded(child: ChildProcess): boolean {
	return child.exitCode !== null || child.signalCode !== null
}

// CAP-022-R01, CAP-022-R02, CAP-022-R05, ADR-018, ADR-005, backend.md 5
@Injectable()
export class TesseractService implements OnModuleInit {
	private readonly logger = new Logger(TesseractService.name)
	private hasWarnedAboutMemoryLimit = false

	// backend.md 5, CAP-026
	async onModuleInit(): Promise<void> {
		const leftovers = (await readdir(tmpdir())).filter((name) => name.startsWith(ATTEMPT_DIRECTORY_PREFIX))
		for (const name of leftovers) {
			await rm(join(tmpdir(), name), { recursive: true, force: true })
		}
		if (leftovers.length > 0) {
			this.logger.warn(`Removed ${leftovers.length} text recognition attempts left by an earlier run`)
		}
	}

	async pdfOf(pages: readonly PageReader[], title: string, settings: TextRecognitionSettings): Promise<Buffer> {
		if (pages.length === 0) {
			throw new Error("text recognition needs at least one page")
		}
		await this.requireModels(settings.tessdataPath)
		const directory = await mkdtemp(join(tmpdir(), ATTEMPT_DIRECTORY_PREFIX))
		try {
			await this.writePages(directory, pages)
			await this.recognize(directory, title, settings)
			return await this.outputOf(directory, pages.length)
		} finally {
			await rm(directory, { recursive: true, force: true })
		}
	}

	// CAP-022-R03
	private async requireModels(tessdataPath: string): Promise<void> {
		for (const language of RECOGNITION_LANGUAGES) {
			const model = join(tessdataPath, `${language}${MODEL_FILE_SUFFIX}`)
			try {
				await access(model, constants.R_OK)
			} catch (error) {
				throw new TextRecognitionError(
					TEXT_RECOGNITION_FAILURE.MODELS_MISSING,
					`the language model ${model} is not readable: ${String(error)}`,
				)
			}
		}
	}

	// backend.md 5
	private async writePages(directory: string, pages: readonly PageReader[]): Promise<void> {
		const options = { flag: NEW_FILE_FLAG, mode: PRIVATE_FILE_MODE }
		for (const [index, read] of pages.entries()) {
			await writeFile(join(directory, pageFileOf(index)), await read(), options)
		}
		await writeFile(join(directory, PAGE_LIST_FILE), pageListOf(pages.length), options)
	}

	// ADR-018, ADR-005, ADR-011 ř. 39, backend.md 5
	private async recognize(directory: string, title: string, settings: TextRecognitionSettings): Promise<void> {
		const child = spawn(settings.sandboxPath, sandboxedArgumentsOf(directory, title, settings), {
			cwd: directory,
			env: SUBPROCESS_ENVIRONMENT,
			stdio: ["ignore", "ignore", "pipe"],
		})
		await this.finished(child, settings)
	}

	// CAP-022-R02, CAP-022-R10
	private async finished(child: ChildProcess, settings: TextRecognitionSettings): Promise<void> {
		return await new Promise<void>((resolve, reject) => {
			let stderrTail = Buffer.alloc(0)
			let stoppedFor: TextRecognitionFailure | undefined
			let isSettled = false
			const stop = (failure: TextRecognitionFailure) => {
				if (stoppedFor !== undefined || hasEnded(child)) {
					return
				}
				stoppedFor = failure
				child.kill(KILL_SIGNAL)
			}
			const timer = setTimeout(() => stop(TEXT_RECOGNITION_FAILURE.TIMED_OUT), settings.timeoutMilliseconds)
			const watchdog = this.memoryWatchdogOf(child, settings.memoryLimitBytes, stop)
			const settle = (error: TextRecognitionError | undefined) => {
				if (isSettled) {
					return
				}
				isSettled = true
				clearTimeout(timer)
				clearInterval(watchdog)
				if (error === undefined) {
					resolve()
					return
				}
				reject(error)
			}
			child.stderr?.on("data", (chunk: Buffer) => {
				stderrTail = Buffer.concat([stderrTail, chunk]).subarray(-STDERR_TAIL_BYTES)
			})
			child.once("error", (error) => {
				if (child.pid === undefined) {
					settle(
						new TextRecognitionError(
							TEXT_RECOGNITION_FAILURE.START_FAILED,
							`the sandbox of tesseract did not start: ${error.message}`,
						),
					)
					return
				}
				this.logger.error(`Tesseract process ${child.pid} reported an error: ${error.message}`)
			})
			child.once("close", (code, signal) => {
				settle(this.exitFailureOf(stoppedFor, code, signal, stderrTail, settings))
			})
		})
	}

	// CAP-022-R02
	private memoryWatchdogOf(
		child: ChildProcess,
		limitBytes: number,
		stop: (failure: TextRecognitionFailure) => void,
	): NodeJS.Timeout | undefined {
		if (process.platform !== PROCESS_STATUS_PLATFORM) {
			this.warnOnceAboutMemoryLimit()
			return undefined
		}
		return setInterval(() => {
			const failure = this.memoryFailureOf(child, limitBytes)
			if (failure !== undefined) {
				stop(failure)
			}
		}, MEMORY_CHECK_INTERVAL_MILLISECONDS)
	}

	private memoryFailureOf(child: ChildProcess, limitBytes: number): TextRecognitionFailure | undefined {
		if (child.pid === undefined || hasEnded(child)) {
			return undefined
		}
		let status: string
		try {
			status = readFileSync(processStatusPathOf(child.pid), "utf8")
		} catch (error) {
			this.logger.error(`The memory of tesseract process ${child.pid} cannot be read: ${String(error)}`)
			return TEXT_RECOGNITION_FAILURE.MEMORY_UNWATCHED
		}
		const peakBytes = peakResidentBytesOf(status)
		return peakBytes !== undefined && peakBytes > limitBytes ? TEXT_RECOGNITION_FAILURE.MEMORY_EXCEEDED : undefined
	}

	private exitFailureOf(
		stoppedFor: TextRecognitionFailure | undefined,
		code: number | null,
		signal: NodeJS.Signals | null,
		stderrTail: Buffer,
		settings: TextRecognitionSettings,
	): TextRecognitionError | undefined {
		if (stoppedFor === TEXT_RECOGNITION_FAILURE.TIMED_OUT) {
			return new TextRecognitionError(stoppedFor, `tesseract ran longer than ${settings.timeoutMilliseconds} ms`)
		}
		if (stoppedFor === TEXT_RECOGNITION_FAILURE.MEMORY_EXCEEDED) {
			return new TextRecognitionError(stoppedFor, `tesseract went over ${settings.memoryLimitBytes} bytes of memory`)
		}
		if (stoppedFor !== undefined) {
			return new TextRecognitionError(stoppedFor, "the memory of tesseract could not be watched")
		}
		if (code === SUCCESSFUL_EXIT) {
			return undefined
		}
		const written = stderrTail.toString("utf8").trim()
		if (code === ISOLATION_FAILED_EXIT) {
			return new TextRecognitionError(
				TEXT_RECOGNITION_FAILURE.ISOLATION_FAILED,
				`tesseract was not isolated: ${written}`,
			)
		}
		if (code === START_FAILED_EXIT) {
			return new TextRecognitionError(TEXT_RECOGNITION_FAILURE.START_FAILED, `tesseract did not start: ${written}`)
		}
		return new TextRecognitionError(
			TEXT_RECOGNITION_FAILURE.CRASHED,
			`tesseract exited with ${code ?? signal}: ${written}`,
		)
	}

	// CAP-022-R05, CAP-022-R11, ADR-018
	private async outputOf(directory: string, pageCount: number): Promise<Buffer> {
		let pdf: Buffer
		try {
			pdf = await readFile(join(directory, OUTPUT_FILE))
		} catch (error) {
			throw new TextRecognitionError(
				TEXT_RECOGNITION_FAILURE.INVALID_OUTPUT,
				`tesseract wrote no PDF: ${String(error)}`,
			)
		}
		const problem = pdfProblemOf(pdf, pageCount)
		if (problem !== undefined) {
			throw new TextRecognitionError(TEXT_RECOGNITION_FAILURE.INVALID_OUTPUT, problem)
		}
		return pdf
	}

	private warnOnceAboutMemoryLimit(): void {
		if (this.hasWarnedAboutMemoryLimit) {
			return
		}
		this.hasWarnedAboutMemoryLimit = true
		this.logger.warn(`The memory limit of text recognition is not enforced on ${process.platform}`)
	}
}
