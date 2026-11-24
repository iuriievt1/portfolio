import { execFile } from "node:child_process"
import { resolve } from "node:path"
import { promisify } from "node:util"

const run = promisify(execFile)
const REPOSITORY = resolve(__dirname, "../../..")
// docker-compose.yml
const DATABASE_SERVICE = "postgres"
const COMPOSE_WAIT_SECONDS = "120"
// provoz-a-dohled.md 7.2, CAP-028-R06
const LIVE_PATH = "/health/live"
const READY_PATH = "/health/ready"
// https://www.medplum.com/docs/self-hosting/running-medplum-server
const CLINICAL_RECORD_HEALTH_PATH = "healthcheck"
const HTTP_OK = 200
const FIELD_SEPARATOR = "|"
const RUNNING = "true"

export interface ContainerState {
	isRunning: boolean
	startedAt: string
	restartCount: number
}

export interface ProcessHealth {
	isLive: boolean
	isReady: boolean
}

async function statusOf(url: string): Promise<number | undefined> {
	try {
		return (await fetch(url)).status
	} catch {
		return undefined
	}
}

// CAP-028-R06, CAP-028-R21
export async function healthOf(surveillanceUrl: string): Promise<ProcessHealth> {
	const [live, ready] = await Promise.all([
		statusOf(`${surveillanceUrl}${LIVE_PATH}`),
		statusOf(`${surveillanceUrl}${READY_PATH}`),
	])
	return { isLive: live === HTTP_OK, isReady: ready === HTTP_OK }
}

// CAP-021-R36, docker-compose.yml clinical-record
export async function isClinicalRecordStoreReady(clinicalRecordUrl: string): Promise<boolean> {
	try {
		const response = await fetch(new URL(CLINICAL_RECORD_HEALTH_PATH, clinicalRecordUrl))
		const health = (await response.json()) as { postgres?: boolean }
		return response.status === HTTP_OK && health.postgres === true
	} catch {
		return false
	}
}

// CAP-028-S08
export async function containerStateOf(name: string): Promise<ContainerState> {
	const format = ["{{.State.Running}}", "{{.State.StartedAt}}", "{{.RestartCount}}"].join(FIELD_SEPARATOR)
	const { stdout } = await run("docker", ["inspect", "--format", format, name])
	const [running, startedAt, restartCount] = stdout.trim().split(FIELD_SEPARATOR)
	if (startedAt === undefined || restartCount === undefined) {
		throw new Error(`docker inspect of ${name} answered ${stdout}`)
	}
	return { isRunning: running === RUNNING, startedAt, restartCount: Number(restartCount) }
}

export async function stopDatabase(): Promise<void> {
	await run("docker", ["compose", "stop", DATABASE_SERVICE], { cwd: REPOSITORY })
}

export async function startDatabase(): Promise<void> {
	await run("docker", ["compose", "up", "-d", "--wait", "--wait-timeout", COMPOSE_WAIT_SECONDS, DATABASE_SERVICE], {
		cwd: REPOSITORY,
	})
}

export async function databaseLogSince(since: Date): Promise<string> {
	const { stdout, stderr } = await run(
		"docker",
		["compose", "logs", "--no-color", "--since", since.toISOString(), DATABASE_SERVICE],
		{ cwd: REPOSITORY },
	)
	return `${stdout}${stderr}`
}
