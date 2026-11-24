import type { AuditRecord } from "@ansora/core-server/ports"
import { describe, expect, it } from "vitest"
import { framed, SyslogFramingError } from "../framing"
import { syslogMessage } from "../message"

const RECORD: AuditRecord = {
	id: "00000000-0000-4000-8000-000000000001",
	sequence: 7,
	occurredAt: "2026-10-06T08:05:09.123Z",
	eventType: "device-approval",
	actorKind: "user",
	actorUserId: "11111111-1111-4111-8111-111111111111",
	actorDeviceId: null,
	systemJob: null,
	sessionId: null,
	objectId: "33333333-3333-4333-8333-333333333333",
	sourceAddress: "192.0.2.10",
	outcome: "success",
	details: { reason: 'line one\nline "two" ]' },
	previousHash: "a".repeat(64),
	hash: "b".repeat(64),
}

const SETTINGS = { format: "rfc5424", enterpriseNumber: 32_473, hostname: "worker 1" } as const

describe("syslog message", () => {
	it("CAP-025-R08 writes RFC 5424 with structured data, codes and the details as UTF-8 JSON", () => {
		const text = syslogMessage(RECORD, SETTINGS).toString("utf8")
		expect(text).toBe(
			"<110>1 2026-10-06T08:05:09.123Z worker1 ansora-vulna - audit " +
				`[audit@32473 id="${RECORD.id}" sequence="7" eventType="device-approval" outcome="success" actorKind="user" ` +
				`userId="${RECORD.actorUserId}" objectId="${RECORD.objectId}" sourceAddress="192.0.2.10" ` +
				`previousHash="${"a".repeat(64)}" hash="${"b".repeat(64)}"] ` +
				'﻿{"reason":"line one\\nline \\"two\\" ]"}',
		)
	})

	it("escapes quotes, backslashes and closing brackets inside structured data", () => {
		const text = syslogMessage({ ...RECORD, eventType: 'a"b\\c]d' }, SETTINGS).toString("utf8")
		expect(text).toContain('eventType="a\\"b\\\\c\\]d"')
	})

	it("marks a failure with the warning severity of the log audit facility", () => {
		expect(
			syslogMessage({ ...RECORD, outcome: "failure" }, SETTINGS)
				.toString("utf8")
				.startsWith("<108>1 "),
		).toBe(true)
	})

	it("CAP-025-R08 writes RFC 3164 with the whole record in the content", () => {
		const text = syslogMessage({ ...RECORD, previousHash: "" }, { ...SETTINGS, format: "rfc3164" }).toString("utf8")
		expect(text.startsWith("<110>Oct  6 08:05:09 worker1 ansora-vulna: {")).toBe(true)
		const content = JSON.parse(text.slice(text.indexOf("{"))) as Record<string, unknown>
		expect(content).toMatchObject({ id: RECORD.id, eventType: "device-approval", details: RECORD.details })
		expect(content).not.toHaveProperty("previousHash")
	})

	it("CAP-025-R23 carries the event type and outcome as codes without any translation", () => {
		const text = syslogMessage(RECORD, SETTINGS).toString("utf8")
		expect(text).toContain('eventType="device-approval"')
		expect(text).not.toMatch(/Schválení|zařízení/)
	})

	it("CAP-025-S19 writes two rejections with the same code identically apart from who, where and when", () => {
		const rejection: AuditRecord = {
			...RECORD,
			eventType: "device-approval-rejected",
			outcome: "failure",
			details: { reason: "fingerprint-mismatch" },
		}
		const englishUser: AuditRecord = {
			...rejection,
			id: "00000000-0000-4000-8000-000000000002",
			sequence: 8,
			occurredAt: "2026-10-06T08:05:10.000Z",
			actorUserId: "22222222-2222-4222-8222-222222222222",
			sourceAddress: "192.0.2.20",
			previousHash: "c".repeat(64),
			hash: "d".repeat(64),
		}
		const czechUser: AuditRecord = {
			...rejection,
			id: "00000000-0000-4000-8000-000000000003",
			sequence: 9,
			occurredAt: "2026-10-06T08:05:11.000Z",
			actorUserId: "44444444-4444-4444-8444-444444444444",
			sourceAddress: "192.0.2.30",
			previousHash: "d".repeat(64),
			hash: "e".repeat(64),
		}
		const withoutIdentity = (record: AuditRecord): string => {
			const varying: (string | null)[] = [
				record.id,
				record.occurredAt,
				`"${record.sequence}"`,
				record.actorUserId,
				record.sourceAddress,
				record.hash,
				record.previousHash,
			]
			return varying
				.filter((value): value is string => value !== null)
				.reduce((text, value) => text.replaceAll(value, "*"), syslogMessage(record, SETTINGS).toString("utf8"))
		}

		expect(withoutIdentity(englishUser)).toBe(withoutIdentity(czechUser))
		expect(withoutIdentity(englishUser)).toContain('{"reason":"fingerprint-mismatch"}')
	})
})

describe("syslog framing", () => {
	const message = Buffer.from("ž message", "utf8")

	it("counts octets, not characters, over TLS and plain TCP", () => {
		expect(framed(message, "tls", "octet_counting").toString("utf8")).toBe("10 ž message")
		expect(framed(message, "tcp", "octet_counting").toString("utf8")).toBe("10 ž message")
		expect(framed(message, "tls", "non_transparent").toString("utf8")).toBe("10 ž message")
	})

	it("ends a message with a line feed only when the receiver asks for it", () => {
		expect(framed(message, "tcp", "non_transparent").toString("utf8")).toBe("ž message\n")
		expect(() => framed(Buffer.from("a\nb"), "tcp", "non_transparent")).toThrow(SyslogFramingError)
	})
})
