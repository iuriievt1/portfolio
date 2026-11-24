import { AUDIT_OUTCOME, type AuditRecord, SYSLOG_FORMAT, type SyslogFormat } from "@ansora/core-server/ports"

const FACILITY_LOG_AUDIT = 13
const SEVERITY_WARNING = 4
const SEVERITY_INFORMATIONAL = 6
const FACILITY_SHIFT = 8
const VERSION = "1"
const APP_NAME = "ansora-vulna"
const NIL = "-"
const MSGID = "audit"
const SD_NAME = "audit"
const BOM = "\ufeff"
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const
const DAY_WIDTH = 2
const TIME_WIDTH = 2
const HOSTNAME_MAX_LENGTH = 255
const NOT_PRINTABLE = /[^\x21-\x7e]/g
const SD_VALUE_SPECIAL = /["\\\]]/g

export interface MessageSettings {
	format: SyslogFormat
	enterpriseNumber: number
	hostname: string
}

// RFC 5424 6.2.1
function priority(record: AuditRecord): string {
	const severity = record.outcome === AUDIT_OUTCOME.FAILURE ? SEVERITY_WARNING : SEVERITY_INFORMATIONAL
	return `<${FACILITY_LOG_AUDIT * FACILITY_SHIFT + severity}>`
}

function printableHostname(value: string): string {
	const cleaned = value.replace(NOT_PRINTABLE, "").slice(0, HOSTNAME_MAX_LENGTH)
	return cleaned === "" ? NIL : cleaned
}

function recordFields(record: AuditRecord): [string, string | number | null][] {
	return [
		["id", record.id],
		["sequence", record.sequence],
		["eventType", record.eventType],
		["outcome", record.outcome],
		["actorKind", record.actorKind],
		["userId", record.actorUserId],
		["deviceId", record.actorDeviceId],
		["systemJob", record.systemJob],
		["sessionId", record.sessionId],
		["objectId", record.objectId],
		["sourceAddress", record.sourceAddress],
		["previousHash", record.previousHash === "" ? null : record.previousHash],
		["hash", record.hash],
	]
}

// RFC 5424 6.3.3
function structuredData(record: AuditRecord, enterpriseNumber: number): string {
	const parameters = recordFields(record)
		.filter(([, value]) => value !== null)
		.map(([name, value]) => `${name}="${String(value).replace(SD_VALUE_SPECIAL, (special) => `\\${special}`)}"`)
	return `[${SD_NAME}@${enterpriseNumber} ${parameters.join(" ")}]`
}

// RFC 5424 6
function rfc5424(record: AuditRecord, settings: MessageSettings): string {
	const header = [
		`${priority(record)}${VERSION}`,
		record.occurredAt,
		printableHostname(settings.hostname),
		APP_NAME,
		NIL,
		MSGID,
	].join(" ")
	return `${header} ${structuredData(record, settings.enterpriseNumber)} ${BOM}${JSON.stringify(record.details)}`
}

function padded(value: number, width: number, filler: string): string {
	return String(value).padStart(width, filler)
}

// RFC 3164 4.1.2
function legacyTimestamp(iso: string): string {
	const time = new Date(iso)
	const month = MONTHS[time.getUTCMonth()] ?? MONTHS[0]
	const day = padded(time.getUTCDate(), DAY_WIDTH, " ")
	const clock = [time.getUTCHours(), time.getUTCMinutes(), time.getUTCSeconds()]
		.map((part) => padded(part, TIME_WIDTH, "0"))
		.join(":")
	return `${month} ${day} ${clock}`
}

// RFC 3164 4.1
function rfc3164(record: AuditRecord, settings: MessageSettings): string {
	const content = Object.fromEntries([
		...recordFields(record).filter(([, value]) => value !== null),
		["time", record.occurredAt],
		["details", record.details],
	])
	return `${priority(record)}${legacyTimestamp(record.occurredAt)} ${printableHostname(settings.hostname)} ${APP_NAME}: ${JSON.stringify(content)}`
}

// CAP-025-R08, CAP-025-R23
export function syslogMessage(record: AuditRecord, settings: MessageSettings): Buffer {
	const text = settings.format === SYSLOG_FORMAT.RFC3164 ? rfc3164(record, settings) : rfc5424(record, settings)
	return Buffer.from(text, "utf8")
}
