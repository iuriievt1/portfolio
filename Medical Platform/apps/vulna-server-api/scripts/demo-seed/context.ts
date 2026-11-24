import { CODE_LIST, ROLE } from "@ansora/contracts"
import type postgres from "@veevoy/postgres"
import { demoId } from "./demo-id"
import type { DemoDataset, DemoTitle } from "./demo-types"

const MANUAL_ROLE_ORIGIN = "manual"

// Q-040
export const STAND_OPERATOR = {
	personalNumber: "900000",
	givenName: "Demo",
	familyName: "Vulna",
	departmentCode: "DEMO",
} as const

export interface Operator {
	userId: string
	departmentId: string
}

interface TitleItem {
	code: string
	name: string | null
}

function missingOperatorMessage(personalNumber: string | undefined): string {
	if (personalNumber === undefined) {
		return "No active clinician with a department; sign in once in the app first"
	}
	return `No active clinician with a department has the personal number ${personalNumber}; sign in once in the app first`
}

export const STAND_OPERATOR_USER_ID = demoId("user/stand-operator")

function earliestVisitStartOf(dataset: DemoDataset): Date {
	const starts = dataset.patients.flatMap((patient) => patient.visits.map((visit) => Date.parse(visit.startedAt)))
	if (starts.length === 0) {
		throw new Error("The demo dataset has no visit")
	}
	return new Date(Math.min(...starts))
}

// Q-040
export async function ensureStandOperator(tx: postgres.TransactionSql, dataset: DemoDataset): Promise<void> {
	await tx`INSERT INTO department (id, code) VALUES (${demoId("department/stand")}, ${STAND_OPERATOR.departmentCode})
		ON CONFLICT (code) DO NOTHING`
	const userId = STAND_OPERATOR_USER_ID
	await tx`
		INSERT INTO app_user (id, given_name, family_name, display_name, personal_number, department_id)
		SELECT ${userId}, ${STAND_OPERATOR.givenName}, ${STAND_OPERATOR.familyName},
			${`${STAND_OPERATOR.givenName} ${STAND_OPERATOR.familyName}`}, ${STAND_OPERATOR.personalNumber}, d.id
		FROM department d WHERE d.code = ${STAND_OPERATOR.departmentCode}
		ON CONFLICT (id) DO NOTHING
	`
	await tx`INSERT INTO user_role (user_id, role, origin) VALUES (${userId}, ${ROLE.CLINICIAN}, ${MANUAL_ROLE_ORIGIN})
		ON CONFLICT DO NOTHING`
	await ensureStandOperatorDepartmentHistory(tx, earliestVisitStartOf(dataset))
}

// ADR-050 (doplnění D34) bod 4, datovy-model.md 4
async function ensureStandOperatorDepartmentHistory(tx: postgres.TransactionSql, validFrom: Date): Promise<void> {
	await tx`
		INSERT INTO user_department_history (id, user_id, department_id, valid_from)
		SELECT ${demoId("user/stand-operator/department-history")}, u.id, u.department_id, ${validFrom}
		FROM app_user u
		WHERE u.id = ${STAND_OPERATOR_USER_ID} AND u.department_id IS NOT NULL
			AND NOT EXISTS (SELECT 1 FROM user_department_history h WHERE h.user_id = u.id)
	`
}

// CAP-003-R07, CAP-020-R04
export async function operatorOf(tx: postgres.TransactionSql, personalNumber: string | undefined): Promise<Operator> {
	const rows = await tx<{ id: string; department_id: string }[]>`
		SELECT u.id, u.department_id FROM app_user u
		WHERE u.is_active AND u.department_id IS NOT NULL
			AND EXISTS (SELECT 1 FROM user_role r WHERE r.user_id = u.id AND r.role = ${ROLE.CLINICIAN})
			AND (${personalNumber ?? null}::text IS NULL OR u.personal_number = ${personalNumber ?? null})
		ORDER BY u.created_at, u.id
	`
	const [operator] = rows
	if (operator === undefined) {
		throw new Error(missingOperatorMessage(personalNumber))
	}
	if (rows.length > 1) {
		throw new Error(
			`${rows.length} clinicians with a department; pass the personal number of the demo clinician: pnpm db:seed-demo <personal number>`,
		)
	}
	return { userId: operator.id, departmentId: operator.department_id }
}

// CAP-012-R19
export async function configurationVersionOf(tx: postgres.TransactionSql): Promise<number> {
	const [row] = await tx<{ id: number | null }[]>`SELECT max(id) AS id FROM configuration_version`
	if (row?.id === null || row?.id === undefined) {
		throw new Error("The instance has no configuration version; run pnpm migrate first")
	}
	return row.id
}

// CAP-017-R09
export async function codeListVersionOf(tx: postgres.TransactionSql): Promise<number> {
	const [row] = await tx<{ version: number | null }[]>`SELECT max(version) AS version FROM code_list_set`
	if (row?.version === null || row?.version === undefined) {
		throw new Error("The instance has no code list set; run pnpm migrate first")
	}
	return row.version
}

// CAP-017-R08, CAP-017-R16
export async function requireOffered(
	tx: postgres.TransactionSql,
	codeListCode: string,
	codes: readonly string[],
): Promise<void> {
	const wanted = [...new Set(codes)]
	const offered = await tx<{ code: string }[]>`
		SELECT code FROM code_list_item
		WHERE code_list_code = ${codeListCode} AND is_active AND code IN ${tx(wanted)}
	`
	const offeredCodes = new Set(offered.map((row) => row.code))
	const missing = wanted.filter((code) => !offeredCodes.has(code))
	if (missing.length > 0) {
		throw new Error(`The code list ${codeListCode} does not offer ${missing.join(", ")}`)
	}
}

// CAP-024-R07
export async function patientIdOf(
	tx: postgres.TransactionSql,
	dataset: DemoDataset,
	identifier: string,
): Promise<string> {
	const [row] = await tx<{ patient_id: string }[]>`
		SELECT patient_id FROM patient_identifier
		WHERE system = ${dataset.patientIdSystem} AND value = ${identifier} AND issuer = ${dataset.issuer}
	`
	if (row === undefined) {
		throw new Error(`The synthetic patient ${identifier} is not in the registry cache; run pnpm db:seed-registry first`)
	}
	return row.patient_id
}

// CAP-018-R15, CAP-017-R05, CAP-017-R20, CAP-025-R03
export async function requireTitles(
	tx: postgres.TransactionSql,
	titles: readonly DemoTitle[],
	defaultLanguage: string,
): Promise<Map<string, string>> {
	const items = await tx<TitleItem[]>`
		SELECT item.code, name.name FROM code_list_item item
		LEFT JOIN code_list_item_name name ON name.code_list_item_id = item.id AND name.language = ${defaultLanguage}
		WHERE item.code_list_code = ${CODE_LIST.DOCUMENT_TITLE} AND item.is_active
	`
	const codes = new Map<string, string>()
	const missing: string[] = []
	for (const title of titles) {
		const name = title.names[defaultLanguage]
		const stored = items.find((item) => item.code === title.code || (name !== undefined && item.name === name))
		if (stored === undefined) {
			missing.push(name ?? title.code)
			continue
		}
		codes.set(title.code, stored.code)
	}
	if (missing.length > 0) {
		throw new Error(
			`The code list ${CODE_LIST.DOCUMENT_TITLE} does not offer ${missing.join(", ")}; add them in the administration first`,
		)
	}
	return codes
}
