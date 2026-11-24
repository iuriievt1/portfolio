import { type ChildProcess, spawn } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { connect } from "node:net"
import { join } from "node:path"
import type { Duplex } from "node:stream"
import { type AdapterCase, adapterConformance } from "./adapter"
import { type CheckResult, confirmFromWire, connectivity } from "./connectivity"
import { type DicomTarget, PEERS, throughProxy } from "./peers"

const TIMEOUT_MS = 10_000
// integrace-dicom.md 11.1
const IMAGE_LABEL = /^node_(\d+)-[a-z]+-slim$/
const PROXY_READY_EVENT = '"wire-proxy-listening"'

function required(name: string): string {
	const value = process.env[name]
	if (value === undefined || value === "") {
		throw new Error(`${name} is required`)
	}
	return value
}

// ADR-017, Q-041
function imageLabel(): string {
	const label = required("DICOM_SUITE_IMAGE")
	const major = IMAGE_LABEL.exec(label)?.[1]
	const runtimeMajor = process.versions.node.split(".")[0]
	if (major === undefined || major !== runtimeMajor) {
		throw new Error(`DICOM_SUITE_IMAGE "${label}" does not match Node.js ${process.version}`)
	}
	return label
}

function openSocket(target: DicomTarget): Promise<Duplex> {
	return new Promise((resolve, reject) => {
		const socket = connect({ host: target.host, port: target.port })
		const timer = setTimeout(() => {
			socket.destroy()
			reject(new Error(`no TCP connection within ${TIMEOUT_MS} ms`))
		}, TIMEOUT_MS)
		socket.once("connect", () => {
			clearTimeout(timer)
			resolve(socket)
		})
		socket.once("error", (error) => {
			clearTimeout(timer)
			reject(error)
		})
	})
}

interface WireProxy {
	child: ChildProcess
	exited: Promise<number | null>
}

// integrace-dicom.md 9.1
function startWireProxy(evidence: string): Promise<WireProxy> {
	const child = spawn(process.execPath, [join(__dirname, "..", "wire", "run.js")], {
		env: { ...process.env, DICOM_WIRE_EVIDENCE: evidence },
		stdio: ["ignore", "pipe", "inherit"],
	})
	const exited = new Promise<number | null>((resolve) => child.once("exit", (code) => resolve(code)))
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			child.kill()
			reject(new Error(`the wire proxy did not start within ${TIMEOUT_MS} ms`))
		}, TIMEOUT_MS)
		let output = ""
		child.stdout?.on("data", (chunk: Buffer) => {
			output += chunk.toString("utf8")
			if (output.includes(PROXY_READY_EVENT)) {
				clearTimeout(timer)
				resolve({ child, exited })
			}
		})
		void exited.then((code) => {
			clearTimeout(timer)
			reject(new Error(`the wire proxy exited with ${code} before it was ready`))
		})
	})
}

async function stopWireProxy(proxy: WireProxy): Promise<void> {
	if (proxy.child.exitCode !== null) {
		throw new Error(`the wire proxy exited early with ${proxy.child.exitCode}`)
	}
	proxy.child.kill("SIGTERM")
	const timedOut = new Promise<"timed-out">((resolve) => setTimeout(() => resolve("timed-out"), TIMEOUT_MS).unref())
	const code = await Promise.race([proxy.exited, timedOut])
	if (code === "timed-out") {
		proxy.child.kill("SIGKILL")
		throw new Error(`the wire proxy did not stop within ${TIMEOUT_MS} ms`)
	}
	if (code !== 0) {
		throw new Error(`the wire proxy exited with ${code}`)
	}
}

async function throughWireProxy<T>(evidence: string, phase: () => Promise<T>): Promise<T> {
	const proxy = await startWireProxy(evidence)
	let result: T
	try {
		result = await phase()
	} catch (error) {
		await stopWireProxy(proxy).catch(() => undefined)
		throw error
	}
	await stopWireProxy(proxy)
	return result
}

interface AdapterCheck {
	id: string
	source: string
	result: "pass" | "fail"
	cases: AdapterCase[]
}

function writeJson(path: string, value: unknown): void {
	writeFileSync(path, `${JSON.stringify(value, null, "\t")}\n`)
}

async function main(): Promise<void> {
	const image = imageLabel()
	const evidence = join(required("DICOM_EVIDENCE"), image)
	const wireEvidence = join(evidence, "wire")
	const callingAeTitle = required("DICOM_CALLING_AE_TITLE")
	const startedAt = new Date().toISOString()
	mkdirSync(join(evidence, "checks"), { recursive: true })
	const targets = PEERS.map(throughProxy)
	const clientView = await throughWireProxy(wireEvidence, () =>
		connectivity(targets, callingAeTitle, openSocket, TIMEOUT_MS),
	)
	const adapterWireEvidence = join(evidence, "wire-adapter")
	const adapter = await throughWireProxy(adapterWireEvidence, () => adapterConformance(targets, callingAeTitle))
	const cases = adapter.confirm(adapterWireEvidence)
	const checks: (CheckResult | AdapterCheck)[] = [
		confirmFromWire(clientView, targets, wireEvidence, callingAeTitle),
		{
			id: "adapter",
			source: "integrace-dicom.md 6, 8, 11, ADR-003 ř. 29, ADR-017",
			result: cases.every((adapterCase) => adapterCase.result === "pass") ? "pass" : "fail",
			cases,
		},
	]
	for (const check of checks) {
		writeJson(join(evidence, "checks", `${check.id}.json`), check)
	}
	const result = checks.every((check) => check.result === "pass") ? "pass" : "fail"
	writeJson(join(evidence, "summary.json"), {
		image,
		node: process.version,
		platform: process.platform,
		arch: process.arch,
		startedAt,
		finishedAt: new Date().toISOString(),
		checks: checks.map((check) => ({ id: check.id, result: check.result })),
		result,
	})
	console.log(JSON.stringify({ event: "suite-finished", image, node: process.version, result }))
	process.exitCode = result === "pass" ? 0 : 1
}

main().catch((error: unknown) => {
	console.error(error)
	process.exitCode = 1
})
