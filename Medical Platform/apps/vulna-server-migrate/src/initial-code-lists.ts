import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import {
	CODE_LIST_SET_LOCK_KEY,
	FIRST_CODE_LIST_ITEM_SEQUENCE,
	FIRST_CODE_LIST_SET_VERSION,
	JOB_KIND,
	JOB_OBJECT_KIND,
	JOB_STATE,
	PROFILE_ARTIFACT,
	type ProfileCodeList,
	type ProfileCodeLists,
} from "@ansora/core-server"
import type postgres from "@veevoy/postgres"

const CODE_LISTS_FILE = resolve(__dirname, "../../../dist/profile", PROFILE_ARTIFACT.CODE_LISTS)
const FIRST_LIST_SEQUENCE = 1
const LIST_COLUMNS = ["code", "name", "sequence"] as const
const ITEM_COLUMNS = ["id", "code_list_code", "code", "sequence"] as const
const NAME_COLUMNS = ["code_list_item_id", "language", "name"] as const

export interface BodyDiagramState {
	version: string
	digest: string
}

export interface CodeListsOutcome {
	addedLists: string[]
	codeListSetVersion: number | undefined
}

interface LatestCodeListSet {
	version: number
	body_diagram_version: string
	body_diagram_digest: string
}

export async function readProfileCodeLists(): Promise<ProfileCodeLists> {
	return JSON.parse(await readFile(CODE_LISTS_FILE, "utf8")) as ProfileCodeLists
}

// CAP-017-R06, CAP-017-R07, CAP-017-R09, CAP-017-R20, NAB-529, ADR-023
export async function writeCodeLists(
	sql: postgres.Sql,
	profile: ProfileCodeLists,
	bodyDiagram: BodyDiagramState,
): Promise<CodeListsOutcome> {
	return await sql.begin(async (tx) => {
		await tx`SELECT pg_advisory_xact_lock(${CODE_LIST_SET_LOCK_KEY})`
		const addedLists = await writeMissingCodeLists(tx, profile)
		const codeListSetVersion = await ensureCodeListSet(tx, bodyDiagram, addedLists.length > 0)
		return { addedLists, codeListSetVersion }
	})
}

async function writeMissingCodeLists(tx: postgres.TransactionSql, profile: ProfileCodeLists): Promise<string[]> {
	if (profile.codeLists.length === 0) {
		return []
	}
	const rows = profile.codeLists.map((list, position) => ({
		code: list.code,
		name: list.name,
		sequence: position + FIRST_LIST_SEQUENCE,
	}))
	const inserted = await tx<{ code: string }[]>`
		INSERT INTO code_list ${tx(rows, ...LIST_COLUMNS)}
		ON CONFLICT (code) DO NOTHING
		RETURNING code
	`
	const insertedCodes = new Set(inserted.map((row) => row.code))
	const added = profile.codeLists.filter((list) => insertedCodes.has(list.code))
	await writeItems(tx, added)
	return added.map((list) => list.code)
}

async function writeItems(tx: postgres.TransactionSql, lists: readonly ProfileCodeList[]): Promise<void> {
	const items = lists.flatMap((list) =>
		list.items.map((item, position) => ({
			id: randomUUID(),
			code_list_code: list.code,
			code: item.code,
			sequence: position + FIRST_CODE_LIST_ITEM_SEQUENCE,
			names: item.names,
		})),
	)
	if (items.length === 0) {
		return
	}
	await tx`INSERT INTO code_list_item ${tx(items, ...ITEM_COLUMNS)}`
	const names = items.flatMap((item) =>
		item.names.map((name) => ({ code_list_item_id: item.id, language: name.language, name: name.name })),
	)
	if (names.length === 0) {
		return
	}
	await tx`INSERT INTO code_list_item_name ${tx(names, ...NAME_COLUMNS)}`
}

// CAP-017-R09, CAP-017-R20, CAP-016-R07, CAP-016-R18
async function ensureCodeListSet(
	tx: postgres.TransactionSql,
	bodyDiagram: BodyDiagramState,
	hasNewLists: boolean,
): Promise<number | undefined> {
	const [latest] = await tx<LatestCodeListSet[]>`
		SELECT version, body_diagram_version, body_diagram_digest FROM code_list_set ORDER BY version DESC LIMIT 1
	`
	if (!hasNewLists && latest !== undefined && isCurrent(latest, bodyDiagram)) {
		return undefined
	}
	const id = randomUUID()
	const version = nextSetVersion(latest)
	await tx`
		INSERT INTO code_list_set (id, version, body_diagram_version, body_diagram_digest)
		VALUES (${id}, ${version}, ${bodyDiagram.version}, ${bodyDiagram.digest})
	`
	await tx`
		INSERT INTO queue_task (id, kind, object_kind, object_id, state)
		VALUES (${randomUUID()}, ${JOB_KIND.CLINICAL_RECORD_WRITE}, ${JOB_OBJECT_KIND.CODE_LIST_SET}, ${id}, ${JOB_STATE.WAITING})
	`
	return version
}

function isCurrent(latest: LatestCodeListSet, bodyDiagram: BodyDiagramState): boolean {
	return latest.body_diagram_version === bodyDiagram.version && latest.body_diagram_digest === bodyDiagram.digest
}

function nextSetVersion(latest: LatestCodeListSet | undefined): number {
	if (latest === undefined) {
		return FIRST_CODE_LIST_SET_VERSION
	}
	return latest.version + 1
}
