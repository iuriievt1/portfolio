import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { createServer, type Server } from "node:net"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { SANDBOX_PATH, TESSDATA_PATH } from "../constants/text-recognition.constants"
import { TesseractService } from "../services/tesseract.service"
import { pdfProblemOf } from "../utils/pdf-output"

// ADR-005, backend.md 5
const PROBE_SOURCE = resolve(__dirname, "sandbox-probe.c")
const COMPILER = "cc"
const LOOPBACK = "127.0.0.1"
const TIMEOUT_MILLISECONDS = 30_000
const MEMORY_LIMIT_BYTES = 1024 * 1024 * 1024
const PAGES = ["first page", "second page"]

describe("the sandbox of text recognition", () => {
	const workspace = mkdtempSync(join(tmpdir(), "sandbox-probe-"))
	const probe = join(workspace, "probe")
	const configuration = join(workspace, "configuration.json")
	const binaryStore = join(workspace, "binary-store")
	const outside = join(workspace, "outside")
	let server: Server
	let connections = 0

	beforeAll(async () => {
		mkdirSync(binaryStore)
		mkdirSync(outside)
		writeFileSync(configuration, '{"database_url":"postgres://vulna_worker:secret@database/vulna"}')
		writeFileSync(join(binaryStore, "foreign"), "a photo of another patient")
		server = createServer((socket) => {
			connections++
			socket.destroy()
		})
		await new Promise<void>((resolveListening) => server.listen(0, LOOPBACK, resolveListening))
		const address = server.address()
		const port = typeof address === "object" && address !== null ? address.port : 0
		execFileSync(COMPILER, [
			"-O2",
			"-Wall",
			"-Wextra",
			"-Werror",
			`-DCONFIGURATION_FILE="${configuration}"`,
			`-DFOREIGN_ARTEFACT="${join(binaryStore, "foreign")}"`,
			`-DOUTSIDE_DIRECTORY="${outside}"`,
			`-DLISTENING_PORT=${port}`,
			"-o",
			probe,
			PROBE_SOURCE,
		])
	})

	afterAll(async () => {
		await new Promise((resolveClosed) => server.close(resolveClosed))
		rmSync(workspace, { recursive: true, force: true })
	})

	it("ADR-005 lets a probe in place of the tool reach no secret, configuration, foreign artefact or network", async () => {
		const pdf = await new TesseractService().pdfOf(
			PAGES.map((page) => async () => Buffer.from(page)),
			"probe",
			{
				sandboxPath: SANDBOX_PATH,
				tesseractPath: probe,
				tessdataPath: TESSDATA_PATH,
				timeoutMilliseconds: TIMEOUT_MILLISECONDS,
				memoryLimitBytes: MEMORY_LIMIT_BYTES,
			},
		)

		expect(pdfProblemOf(pdf, PAGES.length)).toBeUndefined()
		expect(connections).toBe(0)
	})
})
