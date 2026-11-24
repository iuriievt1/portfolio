import { chownSync, writeFileSync } from "node:fs"
import { networkInterfaces } from "node:os"
import { parseArgs } from "node:util"
import { ROLE } from "@ansora/contracts"
import { DEFAULT_CANONICAL_BASE } from "@ansora/vulna-adapter-clinical-record-medplum"
import {
	type InstallationResult,
	type IssuedCredential,
	installClinicalRecordStore,
} from "@ansora/vulna-adapter-clinical-record-medplum/installation"
import postgres from "@veevoy/postgres"
import { recordBreakGlassUse } from "./break-glass-audit"

// provoz-a-dohled.md 7, CAP-012-R30, CAP-012-S23, ADR-050 bod 10

const ADDRESS_SEPARATOR = ","
const FILE_OWNER = /^(\d+):(\d+)$/
const UNKNOWN_ADDRESS = "unknown"
const CREDENTIAL_FILE_MODE = 0o600
// CAP-012-R30, architektura.md 3
const CREDENTIAL_VARIABLES = {
	api: { clientId: "CLINICAL_RECORD_CLIENT_ID", clientSecret: "CLINICAL_RECORD_CLIENT_SECRET" },
	worker: { clientId: "CLINICAL_RECORD_WORKER_CLIENT_ID", clientSecret: "CLINICAL_RECORD_WORKER_CLIENT_SECRET" },
	// CAP-026-R19, dorucovaci-jadro.md 6
	retention: {
		clientId: "CLINICAL_RECORD_RETENTION_CLIENT_ID",
		clientSecret: "CLINICAL_RECORD_RETENTION_CLIENT_SECRET",
	},
} as const

interface FileOwner {
	uid: number
	gid: number
}

function fileOwnerOf(value: string): FileOwner {
	const [, uid, gid] = FILE_OWNER.exec(value) ?? []
	if (uid === undefined || gid === undefined) {
		throw new Error(`--credential-owner expects uid:gid, got "${value}"`)
	}
	return { uid: Number(uid), gid: Number(gid) }
}

function filledIn(value: string | undefined): string | undefined {
	return value === undefined || value.trim() === "" ? undefined : value
}

function required(name: string): string {
	const value = process.env[name]?.trim()
	if (value === undefined || value === "") {
		throw new Error(`Missing ${name}`)
	}
	return value
}

function hostAddress(): string {
	for (const addresses of Object.values(networkInterfaces())) {
		const external = addresses?.find((address) => address.family === "IPv4" && !address.internal)
		if (external !== undefined) {
			return external.address
		}
	}
	return UNKNOWN_ADDRESS
}

async function rolesOf(sql: postgres.Sql): Promise<string[]> {
	const rows = await sql<{ code: string }[]>`SELECT code FROM role ORDER BY code`
	return rows.map((row) => row.code)
}

interface IssuedFile {
	label: string
	credential: IssuedCredential
	variables: { clientId: string; clientSecret: string }
	file: string | undefined
	rotationFlag: string
}

function credentialLines({ credential, variables }: IssuedFile): string | undefined {
	return credential.clientSecret === undefined
		? undefined
		: `${variables.clientId}=${credential.clientId}\n${variables.clientSecret}=${credential.clientSecret}\n`
}

async function main(): Promise<void> {
	const { values } = parseArgs({
		options: {
			operator: { type: "string" },
			reason: { type: "string" },
			"rotate-api-secret": { type: "boolean", default: false },
			"rotate-worker-secret": { type: "boolean", default: false },
			"rotate-retention-secret": { type: "boolean", default: false },
			"credential-file": { type: "string" },
			"worker-credential-file": { type: "string" },
			"retention-credential-file": { type: "string" },
			"credential-owner": { type: "string" },
		},
	})
	const credentialOwner = values["credential-owner"] === undefined ? undefined : fileOwnerOf(values["credential-owner"])
	const operator = filledIn(values.operator)
	const reason = filledIn(values.reason)
	if (operator === undefined || reason === undefined) {
		throw new Error('Name who runs the procedure and why: --operator "…" --reason "…"')
	}
	const sql = postgres(required("DATABASE_URL_API"), { max: 1 })
	let succeeded = false
	try {
		const roles = await rolesOf(sql)
		const result = await installClinicalRecordStore({
			baseUrl: required("CLINICAL_RECORD_URL"),
			breakGlass: {
				email: required("CLINICAL_RECORD_BREAK_GLASS_EMAIL"),
				password: required("CLINICAL_RECORD_BREAK_GLASS_PASSWORD"),
			},
			adminAddressPrefixes: required("CLINICAL_RECORD_ADMIN_NETWORKS")
				.split(ADDRESS_SEPARATOR)
				.map((prefix) => prefix.trim())
				.filter((prefix) => prefix !== ""),
			canonicalBase: process.env.CLINICAL_RECORD_CANONICAL_BASE?.trim() || DEFAULT_CANONICAL_BASE,
			instance: { code: required("INSTANCE_CODE"), name: required("INSTANCE_NAME") },
			roles,
			// CAP-003-R09, CAP-020-R04
			clinicalRoles: roles.filter((role) => role === ROLE.CLINICIAN),
			rotateApiSecret: values["rotate-api-secret"],
			rotateWorkerSecret: values["rotate-worker-secret"],
			rotateRetentionSecret: values["rotate-retention-secret"],
		})
		succeeded = true
		reportProject(result)
		reportCredential(
			{
				label: "API",
				credential: result.apiCredential,
				variables: CREDENTIAL_VARIABLES.api,
				file: values["credential-file"],
				rotationFlag: "--rotate-api-secret",
			},
			credentialOwner,
		)
		reportCredential(
			{
				label: "worker",
				credential: result.workerCredential,
				variables: CREDENTIAL_VARIABLES.worker,
				file: values["worker-credential-file"],
				rotationFlag: "--rotate-worker-secret",
			},
			credentialOwner,
		)
		reportCredential(
			{
				label: "retention",
				credential: result.retentionCredential,
				variables: CREDENTIAL_VARIABLES.retention,
				file: values["retention-credential-file"],
				rotationFlag: "--rotate-retention-secret",
			},
			credentialOwner,
		)
	} finally {
		await recordBreakGlassUse(sql, {
			operator,
			reason,
			sourceAddress: hostAddress(),
			succeeded,
		})
		await sql.end()
	}
}

function reportProject(result: InstallationResult): void {
	process.stdout.write(
		`clinical record store: project ${result.projectId}, API client ${result.apiCredential.clientId}, ` +
			`worker client ${result.workerCredential.clientId}, retention client ${result.retentionCredential.clientId}, ` +
			`${result.disabledClients.length} other clients switched off, ` +
			`${result.createdPolicies.length} policies created, break-glass sealed\n`,
	)
}

function reportCredential(issued: IssuedFile, owner: FileOwner | undefined): void {
	const credential = credentialLines(issued)
	if (credential === undefined) {
		process.stdout.write(`the ${issued.label} credential stays as it was; ${issued.rotationFlag} issues a new one\n`)
		return
	}
	if (issued.file === undefined) {
		process.stdout.write(`store the ${issued.label} credential as instance secrets:\n${credential}`)
		return
	}
	writeFileSync(issued.file, credential, { mode: CREDENTIAL_FILE_MODE })
	if (owner !== undefined) {
		chownSync(issued.file, owner.uid, owner.gid)
	}
	process.stdout.write(`the ${issued.label} credential is in ${issued.file}\n`)
}

main().catch((error: unknown) => {
	process.stderr.write(
		`clinical record installation failed: ${error instanceof Error ? error.message : String(error)}\n`,
	)
	process.exitCode = 1
})
