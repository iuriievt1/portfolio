import { readFile } from "node:fs/promises"
import {
	ACQUISITION_KIND,
	AUDIT_EVENT_TYPE,
	AUDIT_OUTCOME,
	AUDIT_SEARCH_METHOD,
	type AuditEventType,
} from "@ansora/contracts"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
	describedFinding,
	identifiedPatientId,
	openedRecord,
	placedWound,
	uploadedFile,
	verifiedConfiguration,
} from "../phone/clinical-flow"
import { PHOTO } from "../phone/photo-record"
import { signedInPhone } from "../phone/signed-in-phone"
import type { Clinician } from "../server/clinician"
import { systemContext } from "../support/context"
import { eventually } from "../support/eventually"
import { EXPORT_TIMEOUT_MILLISECONDS, FIRST_SEQUENCE } from "../support/limits"

// quality/data/synteticka-sada/registry.json
const PATIENT_CODE = "1000104"
const CLINICIAN_LABEL = "system-audit"
const DESCRIPTION = "Syntetický popis rány pro audit"
const PHOTOS = [PHOTO, PHOTO]
const LINE_BREAK = "\n"
const MISSING_FILE = "ENOENT"
// RFC 4648 4, ITU-T T.81 B.2
const JPEG_START_BYTES = 6
const JPEG_START_IN_BASE64 = PHOTO.subarray(0, JPEG_START_BYTES).toString("base64")
const IDENTIFICATIONS = [AUDIT_EVENT_TYPE.PATIENT_SEARCH, AUDIT_EVENT_TYPE.PATIENT_SEARCH]
const DRAFT_EVENTS: AuditEventType[] = [
	AUDIT_EVENT_TYPE.DRAFT_ACQUISITION_CREATED,
	...PHOTOS.map(() => AUDIT_EVENT_TYPE.DRAFT_ACQUISITION_UPDATED),
	AUDIT_EVENT_TYPE.DRAFT_ACQUISITION_UPDATED,
	AUDIT_EVENT_TYPE.DRAFT_ACQUISITION_UPDATED,
]

interface AuditRow {
	id: string
	event_type: AuditEventType
}

async function syslogLines(file: string): Promise<string[]> {
	try {
		return (await readFile(file, "utf8")).split(LINE_BREAK)
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === MISSING_FILE) {
			return []
		}
		throw error
	}
}

function exportedLineOf(lines: readonly string[], auditId: string): string | undefined {
	return lines.find((line) => line.includes(` id="${auditId}"`))
}

describe("ADR-024 the audit of a draft record reaches the synthetic Syslog", () => {
	const context = systemContext()
	let clinician: Clinician
	let acquisitionId: string
	let rows: AuditRow[]
	let lines: string[]

	beforeAll(async () => {
		const signedIn = await signedInPhone(context.sql, context.environment.apiUrl, CLINICIAN_LABEL)
		const { phone } = signedIn
		clinician = signedIn.clinician
		const configuration = await verifiedConfiguration(phone)
		await identifiedPatientId(phone, configuration, PATIENT_CODE)
		const patientId = await identifiedPatientId(phone, configuration, PATIENT_CODE)
		const record = await openedRecord(phone, clinician, patientId, ACQUISITION_KIND.PHOTO, configuration)
		acquisitionId = record.acquisitionId
		for (const [index, photo] of PHOTOS.entries()) {
			await uploadedFile(phone, record, configuration.serverKey, photo, photo, FIRST_SEQUENCE + index)
		}
		await placedWound(phone, record)
		await describedFinding(phone, record, DESCRIPTION)
		rows = await context.sql<AuditRow[]>`
			SELECT id, event_type FROM audit WHERE actor_device_id = ${clinician.deviceId} ORDER BY sequence
		`
		const exported = await eventually(
			"the export of every audit record",
			async () => {
				const received = await syslogLines(context.environment.syslogFile)
				return rows.map((row) => exportedLineOf(received, row.id))
			},
			(found) => found.every((line) => line !== undefined),
			EXPORT_TIMEOUT_MILLISECONDS,
		)
		lines = exported.filter((line) => line !== undefined)
	})

	afterAll(async () => {
		await context.close()
	})

	it("CAP-025-S22 writes the creation and each addition of the draft and exports them with their type", () => {
		expect(rows.map((row) => row.event_type)).toEqual([...IDENTIFICATIONS, ...DRAFT_EVENTS])
		for (const [index, row] of rows.entries()) {
			expect(lines[index]).toContain(`eventType="${row.event_type}"`)
		}
	})

	it("CAP-025-S22 names the operator, the device, the session, the patient and the record in every draft record", () => {
		for (const line of lines.slice(IDENTIFICATIONS.length)) {
			expect(line).toContain(`userId="${clinician.userId}"`)
			expect(line).toContain(`deviceId="${clinician.deviceId}"`)
			expect(line).toContain(`sessionId="${clinician.sessionId}"`)
			expect(line).toContain(`objectId="${acquisitionId}"`)
			expect(line).toContain(`"patient_identifier":"${PATIENT_CODE}"`)
		}
	})

	it("CAP-025-S22 exports neither a photo nor the text of the description", () => {
		for (const line of lines) {
			expect(line).not.toContain(JPEG_START_IN_BASE64)
			expect(line).not.toContain(DESCRIPTION)
		}
	})

	it("CAP-025-S17 exports each identification with its way of reading, its outcome and the patient", () => {
		const [created, matched] = lines

		for (const line of [created, matched]) {
			expect(line).toContain(`"search_method":"${AUDIT_SEARCH_METHOD.CODE}"`)
			expect(line).toContain(`"patient_identifier":"${PATIENT_CODE}"`)
		}
		expect(created).toContain(`outcome="${AUDIT_OUTCOME.CREATED}"`)
		expect(matched).toContain(`outcome="${AUDIT_OUTCOME.MATCH}"`)
	})
})
