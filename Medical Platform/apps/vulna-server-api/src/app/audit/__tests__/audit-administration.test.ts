import { AUDIT_ACTOR_KIND, AUDIT_OUTCOME, auditRecordHash, NO_PREVIOUS_HASH, PERMISSIONS } from "@ansora/core-server"
import { describe, expect, it } from "vitest"
import type { DatabaseService } from "../../../libs/database/database.service"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import type { ConfigurationService } from "../../configuration/services/configuration.service"
import type { AdministratorAlertRepository } from "../../monitoring/repositories/administrator-alert.repository"
import type { AuditRepository } from "../repositories/audit.repository"
import type { AuditQueryRepository, NewAuditExport } from "../repositories/audit-query.repository"
import { AuditAdministrationService } from "../services/audit-administration.service"
import type { AuditExportRow, AuditSearchRow, NewAuditEvent } from "../types/audit.types"
import type { AuditRecordsPage, AuditRecordView } from "../types/audit-administration.types"
import { csvHeader, csvLine } from "../utils/audit-csv"
import { auditRecordView } from "../utils/audit-record-view"

const ADMINISTRATOR_ID = "11111111-1111-4111-8111-111111111111"

function auditRows(count: number): AuditSearchRow[] {
	const rows: AuditSearchRow[] = []
	for (let sequence = 1; sequence <= count; sequence += 1) {
		const occurredAt = new Date(Date.UTC(2026, 9, 6, 8, 0, sequence))
		const unhashed = {
			id: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
			sequence,
			occurredAt: occurredAt.toISOString(),
			eventType: "configuration-changed",
			actorKind: AUDIT_ACTOR_KIND.USER,
			actorUserId: ADMINISTRATOR_ID,
			actorDeviceId: null,
			systemJob: null,
			sessionId: null,
			objectId: null,
			sourceAddress: "192.0.2.10",
			outcome: AUDIT_OUTCOME.SUCCESS,
			details: { version: sequence + 1, reason: "=SUM(1;2)" },
			previousHash: rows.at(-1)?.hash ?? NO_PREVIOUS_HASH,
		}
		rows.push({
			id: unhashed.id,
			sequence: String(sequence),
			occurred_at: occurredAt,
			event_type: unhashed.eventType,
			actor_kind: unhashed.actorKind,
			actor_user_id: unhashed.actorUserId,
			actor_device_id: null,
			system_job: null,
			session_id: null,
			object_id: null,
			source_address: unhashed.sourceAddress,
			outcome: unhashed.outcome,
			details: unhashed.details,
			previous_hash: unhashed.previousHash,
			hash: auditRecordHash(unhashed),
			personal_number: "000102",
			display_name: "Petr Svoboda",
		})
	}
	return rows
}

describe("audit CSV", () => {
	it("starts with a byte order mark and a header of technical names", () => {
		const header = csvHeader()
		expect(header.startsWith("﻿sequence;time;id;actor_kind;")).toBe(true)
		expect(header.endsWith("previous_hash;hash\r\n")).toBe(true)
	})

	it("CAP-025-R23 writes codes, quotes cells with separators and keeps the chain fields", () => {
		const [row] = auditRows(1)
		if (row === undefined) {
			throw new Error("no row")
		}
		const line = csvLine(row)
		expect(line).toContain(";configuration-changed;")
		expect(line).toContain(';"{""version"":2,""reason"":""=SUM(1;2)""}";')
		expect(line.endsWith(`;;${row.hash}\r\n`)).toBe(true)
	})

	it("keeps a spreadsheet from running a cell as a formula", () => {
		const [row] = auditRows(1)
		if (row === undefined) {
			throw new Error("no row")
		}
		expect(csvLine({ ...row, display_name: "=HYPERLINK(1)" })).toContain(";'=HYPERLINK(1);")
		expect(csvLine({ ...row, display_name: "-1" })).toContain(";'-1;")
	})
})

describe("audit record view", () => {
	it("CAP-025-R04 names the user, the source address and the chain of a record", () => {
		const [first, second] = auditRows(2)
		if (first === undefined || second === undefined) {
			throw new Error("no rows")
		}
		expect(auditRecordView(first)).toMatchObject({
			id: first.id,
			user: "Petr Svoboda (000102)",
			source_address: "192.0.2.10",
			event_type: "configuration-changed",
			outcome: "success",
			previous_hash: null,
			hash: first.hash,
			device_approval: null,
		})
		expect(auditRecordView(second).previous_hash).toBe(first.hash)
		expect(auditRecordView(first)).not.toHaveProperty("device")
	})

	it("CAP-006-R16 lifts the approval of a device into its own object", () => {
		const [row] = auditRows(1)
		if (row === undefined) {
			throw new Error("no row")
		}
		const view = auditRecordView({
			...row,
			event_type: "device-approval",
			actor_device_id: null,
			details: { fingerprint: "K7Q2M-9XR4T", requester_user_id: "r", administrator_user_id: ADMINISTRATOR_ID },
		})
		expect(view.device_approval).toEqual({
			fingerprint: "K7Q2M-9XR4T",
			requester_user_id: "r",
			administrator_user_id: ADMINISTRATOR_ID,
			blocked_predecessor_hw_id: null,
		})
	})

	it("leaves the device details empty for an event the server wrote itself", () => {
		const [row] = auditRows(1)
		if (row === undefined) {
			throw new Error("no row")
		}
		expect(row.details).not.toEqual({})
		expect(auditRecordView(row).details).toBeNull()
	})

	it("names a system job instead of a user", () => {
		const [row] = auditRows(1)
		if (row === undefined) {
			throw new Error("no row")
		}
		const view = auditRecordView({ ...row, actor_kind: "system_job", actor_user_id: null, system_job: "audit_export" })
		expect(view.user).toBeNull()
		expect(view.system_job).toBe("audit_export")
	})
})

interface Harness {
	service: AuditAdministrationService
	audited: NewAuditEvent[]
	exports: NewAuditExport[]
	chainAlerts: string[]
}

const CHAIN_ALERT_ID = "77777777-7777-4777-8777-777777777777"

const ADMINISTRATOR: AdministrationSession = {
	sessionId: "99999999-9999-4999-8999-999999999999",
	userId: ADMINISTRATOR_ID,
	permissions: PERMISSIONS,
}

function harnessWith(rows: AuditSearchRow[], activeChainAlerts: string[] = []): Harness {
	const audited: NewAuditEvent[] = []
	const exports: NewAuditExport[] = []
	const chainAlerts = activeChainAlerts
	const alerts = {
		raiseForBrokenAuditChain: async (_tx: never, auditId: string) => {
			if (chainAlerts.includes(auditId)) {
				return undefined
			}
			chainAlerts.push(auditId)
			return CHAIN_ALERT_ID
		},
		resolveBrokenAuditChain: async () => {
			chainAlerts.length = 0
		},
	} as unknown as AdministratorAlertRepository
	const queries = {
		page: async (_filter: unknown, limit: number, before: number | undefined) =>
			[...rows]
				.reverse()
				.filter((row) => before === undefined || Number(row.sequence) < before)
				.slice(0, limit),
		inChainOrder: async (onBatch: (batch: AuditSearchRow[]) => Promise<boolean>) => {
			await onBatch(rows)
		},
		latestSequence: async () => rows.length,
		insertExport: async (_tx: never, auditExport: NewAuditExport) => {
			exports.push(auditExport)
		},
		findExport: async (id: string): Promise<AuditExportRow | undefined> => {
			const found = exports.find((entry) => entry.id === id)
			return found === undefined
				? undefined
				: {
						id: found.id,
						requested_by: found.requestedBy,
						requested_at: found.requestedAt,
						from_time: null,
						to_time: null,
						event_type: null,
						until_sequence: String(found.untilSequence),
					}
		},
		exported: async function* () {
			yield rows
		},
		exportCursor: async () => ({
			exported_sequence: "1",
			exported_at: new Date("2026-10-06T08:00:00Z"),
			attempted_at: new Date("2026-10-06T08:01:00Z"),
			failing_since: new Date("2026-10-06T08:01:00Z"),
			last_failure: "unreachable",
		}),
	} as unknown as AuditQueryRepository
	const audit = {
		append: async (_tx: never, event: NewAuditEvent) => {
			audited.push(event)
			return undefined as never
		},
	} as unknown as AuditRepository
	const database = {
		sql: { begin: async (work: (tx: never) => Promise<unknown>) => work({} as never) },
	} as unknown as DatabaseService
	const configuration = {
		pageSize: async () => ({ defaultSize: 2, maxSize: 500 }),
		value: async () => "logs.hospital.example",
		integer: async () => 100_000,
	} as unknown as ConfigurationService
	return {
		service: new AuditAdministrationService(database, queries, audit, configuration, alerts),
		audited,
		exports,
		chainAlerts,
	}
}

async function collected(lines: AsyncIterable<string>): Promise<string[]> {
	const all: string[] = []
	for await (const line of lines) {
		all.push(line)
	}
	return all
}

function recordIds(page: AuditRecordsPage): string[] {
	const records: AuditRecordView[] = page.items ?? []
	return records.map((record) => record.id)
}

describe("AuditAdministrationService", () => {
	it("CAP-025-R07 pages the trail from the newest record with a cursor", async () => {
		const { service } = harnessWith(auditRows(3))

		const first = await service.search({})
		expect(recordIds(first)).toEqual([auditRows(3)[2]?.id, auditRows(3)[1]?.id])
		expect(first.next_cursor).not.toBeNull()

		const second = await service.search({ cursor: first.next_cursor ?? undefined })
		expect(recordIds(second)).toEqual([auditRows(3)[0]?.id])
		expect(second.next_cursor).toBeNull()
	})

	it("confirms an untouched chain without writing a security event", async () => {
		const { service, audited } = harnessWith(auditRows(3))

		const check = await service.verifyChain(ADMINISTRATOR)

		expect(check).toEqual({
			outcome: "intact",
			first_broken_record_id: undefined,
			checked_until: auditRows(3)[2]?.occurred_at.toISOString(),
		})
		expect(audited).toEqual([])
	})

	it("CAP-025-S13 finds a record deleted from the middle and writes it down as a security event", async () => {
		const [first, , third] = auditRows(3)
		if (first === undefined || third === undefined) {
			throw new Error("no rows")
		}
		const { service, audited } = harnessWith([first, third])

		const check = await service.verifyChain(ADMINISTRATOR)

		expect(check).toMatchObject({ outcome: "broken", first_broken_record_id: third.id })
		expect(audited[0]).toEqual(
			expect.objectContaining({
				eventType: "audit-chain-broken",
				outcome: "failure",
				objectId: third.id,
				actorUserId: ADMINISTRATOR_ID,
				details: { first_broken_record_id: third.id, checked_until: first.occurred_at.toISOString() },
			}),
		)
	})

	it("CAP-025-S13 alerts the administrator once per broken record", async () => {
		const [first, , third] = auditRows(3)
		if (first === undefined || third === undefined) {
			throw new Error("no rows")
		}
		const { service, audited, chainAlerts } = harnessWith([first, third])

		await service.verifyChain(ADMINISTRATOR)
		await service.verifyChain(ADMINISTRATOR)

		expect(chainAlerts).toEqual([third.id])
		const raised = audited.filter((event) => event.eventType === "administrator-alert-raised")
		expect(raised).toEqual([
			expect.objectContaining({
				outcome: "failure",
				objectId: CHAIN_ALERT_ID,
				actorUserId: ADMINISTRATOR_ID,
				details: expect.objectContaining({
					alert_id: CHAIN_ALERT_ID,
					alert_kind: "audit_chain_broken",
					audit_record_id: third.id,
					message: expect.stringContaining("Řetěz auditních záznamů je porušený u záznamu z 6. 10. 2026"),
				}),
			}),
		])
		expect(audited.filter((event) => event.eventType === "audit-chain-broken")).toHaveLength(2)
	})

	it("CAP-025-R21 clears the alert once a later check finds the chain intact", async () => {
		const { service, chainAlerts } = harnessWith(auditRows(3), ["00000000-0000-4000-8000-000000000002"])

		await service.verifyChain(ADMINISTRATOR)

		expect(chainAlerts).toEqual([])
	})

	it("CAP-025-S04 refuses an export without the export permission and writes the attempt down", async () => {
		const { service, audited, exports } = harnessWith(auditRows(1))
		const reader = { ...ADMINISTRATOR, permissions: PERMISSIONS.filter((permission) => permission !== "audit.export") }

		await expect(service.requestExport({}, reader)).rejects.toMatchObject({ code: "permission-denied" })
		expect(exports).toEqual([])
		expect(audited).toEqual([
			expect.objectContaining({
				eventType: "audit-export",
				outcome: "failure",
				details: { stage: "requested", reason: "permission-denied" },
			}),
		])
	})

	it("refuses an export whose start is after its end", async () => {
		const { service } = harnessWith(auditRows(1))

		await expect(
			service.requestExport({ from: "2026-10-06T10:00:00Z", to: "2026-10-06T09:00:00Z" }, ADMINISTRATOR),
		).rejects.toMatchObject({ code: "value-out-of-range" })
	})

	it("NAB-442 writes down the export and every download of its file", async () => {
		const rows = auditRows(2)
		const { service, audited } = harnessWith(rows)

		const requested = await service.requestExport({ event_type: "configuration-changed" }, ADMINISTRATOR)
		expect(requested).toEqual({
			id: requested.id,
			state: "done",
			link: `/api/admin/v1/audit/exports/${requested.id}/file`,
		})

		const file = await service.exportFile(requested.id, ADMINISTRATOR)
		const lines = await collected(file.lines)

		expect(file.fileName).toMatch(/^vulna-audit-\d{4}-\d{2}-\d{2}\.csv$/)
		expect(lines).toHaveLength(rows.length + 1)
		expect(audited.map((event) => event.details.stage)).toEqual(["requested", "downloaded"])
		expect(audited[0]).toMatchObject({ objectId: requested.id, details: { until_sequence: 2 } })
	})

	it("gives the file only to the administrator who asked for the export", async () => {
		const { service } = harnessWith(auditRows(1))
		const requested = await service.requestExport({}, ADMINISTRATOR)

		await expect(
			service.exportFile(requested.id, { ...ADMINISTRATOR, userId: "22222222-2222-4222-8222-222222222222" }),
		).rejects.toThrow()
	})

	it("CAP-025-S03 shows how many records wait while the log management system is down", async () => {
		const { service } = harnessWith(auditRows(5))

		expect(await service.exportStatus()).toEqual({
			configured: true,
			exported_until_sequence: 1,
			exported_at: "2026-10-06T08:00:00.000Z",
			latest_sequence: 5,
			pending_count: 4,
			buffer_limit: 100_000,
			attempted_at: "2026-10-06T08:01:00.000Z",
			failing_since: "2026-10-06T08:01:00.000Z",
			last_failure: "unreachable",
		})
	})
})
