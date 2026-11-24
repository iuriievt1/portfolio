import type { AuditRecord, AuditSinkPort } from "@ansora/core-server/ports"
import type { SyslogSettings } from "@ansora/vulna-adapter-syslog"
import { describe, expect, it } from "vitest"
import type { DatabaseService } from "../../../libs/database/database.service"
import { EXPORT_BATCH_SIZE, EXPORT_CYCLE } from "../constants/audit-export.constants"
import type { AuditExportRepository } from "../repositories/audit-export.repository"
import { AuditExportService } from "../services/audit-export.service"
import type { SyslogSettingsService } from "../services/syslog-settings.service"

const SETTINGS: SyslogSettings = {
	host: "logs.hospital.example",
	port: 6514,
	format: "rfc5424",
	transport: "tls",
	framing: "octet_counting",
	enterpriseNumber: 32_473,
	hostname: "worker",
	tls: {},
}

function record(sequence: number): AuditRecord {
	return {
		id: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
		sequence,
		occurredAt: "2026-10-06T08:00:00.000Z",
		eventType: "configuration-changed",
		actorKind: "user",
		actorUserId: "11111111-1111-4111-8111-111111111111",
		actorDeviceId: null,
		systemJob: null,
		sessionId: null,
		objectId: null,
		sourceAddress: null,
		outcome: "success",
		details: {},
		previousHash: "",
		hash: "a".repeat(64),
	}
}

interface Harness {
	service: AuditExportService
	cursor: () => number
	failures: string[]
	sent: number[][]
	setSink: (sink: AuditSinkPort) => void
}

function harnessWith(count: number, options: { configured?: boolean; locked?: boolean } = {}): Harness {
	const audit = Array.from({ length: count }, (_, index) => record(index + 1))
	let exported = 0
	const failures: string[] = []
	const sent: number[][] = []
	let sink: AuditSinkPort = {
		export: async (records) => {
			sent.push(records.map((entry) => entry.sequence))
		},
	}
	const repository = {
		lock: async () => options.locked !== false,
		exportedSequence: async () => exported,
		recordsAfter: async (_tx: never, after: number, limit: number) =>
			audit.filter((entry) => entry.sequence > after).slice(0, limit),
		recordDelivery: async (_tx: never, sequence: number) => {
			exported = sequence
		},
		recordFailure: async (_tx: never, failure: string) => {
			failures.push(failure)
		},
	} as unknown as AuditExportRepository
	const database = {
		sql: { begin: async (work: (tx: never) => Promise<unknown>) => work({} as never) },
	} as unknown as DatabaseService
	const settings = {
		current: async () => (options.configured === false ? undefined : SETTINGS),
	} as unknown as SyslogSettingsService
	return {
		service: new AuditExportService(database, repository, settings, () => ({
			export: (records) => sink.export(records),
		})),
		cursor: () => exported,
		failures,
		sent,
		setSink: (next) => {
			sink = next
		},
	}
}

describe("AuditExportService", () => {
	it("CAP-025-S01 exports new records from the cursor and moves the cursor past them", async () => {
		const { service, cursor, sent } = harnessWith(3)

		expect(await service.exportPending()).toBe(EXPORT_CYCLE.CAUGHT_UP)
		expect(sent).toEqual([[1, 2, 3]])
		expect(cursor()).toBe(3)
		expect(await service.exportPending()).toBe(EXPORT_CYCLE.CAUGHT_UP)
		expect(sent).toHaveLength(1)
	})

	it("CAP-025-S03 keeps the records and the cursor while the log management system is down", async () => {
		const harness = harnessWith(2)
		harness.setSink({
			export: async () => {
				throw Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" })
			},
		})

		expect(await harness.service.exportPending()).toBe(EXPORT_CYCLE.FAILED)
		expect(harness.cursor()).toBe(0)
		expect(harness.failures).toEqual(["unreachable"])

		harness.setSink({
			export: async (records) => {
				harness.sent.push(records.map((entry) => entry.sequence))
			},
		})
		expect(await harness.service.exportPending()).toBe(EXPORT_CYCLE.CAUGHT_UP)
		expect(harness.sent).toEqual([[1, 2]])
		expect(harness.cursor()).toBe(2)
	})

	it("asks for another run at once when a full batch went out", async () => {
		const { service, cursor } = harnessWith(EXPORT_BATCH_SIZE + 1)

		expect(await service.exportPending()).toBe(EXPORT_CYCLE.MORE_WAITING)
		expect(cursor()).toBe(EXPORT_BATCH_SIZE)
		expect(await service.exportPending()).toBe(EXPORT_CYCLE.CAUGHT_UP)
		expect(cursor()).toBe(EXPORT_BATCH_SIZE + 1)
	})

	it("waits without sending while no log management system is configured", async () => {
		const { service, sent, cursor } = harnessWith(2, { configured: false })

		expect(await service.exportPending()).toBe(EXPORT_CYCLE.NOT_CONFIGURED)
		expect(sent).toEqual([])
		expect(cursor()).toBe(0)
	})

	it("leaves the export to the worker that already holds it", async () => {
		const { service, sent } = harnessWith(2, { locked: false })

		expect(await service.exportPending()).toBe(EXPORT_CYCLE.HELD_ELSEWHERE)
		expect(sent).toEqual([])
	})
})
