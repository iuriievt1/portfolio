import { type AuditRecord, type AuditSinkPort, SYSLOG_TRANSPORT, type SyslogFraming } from "@ansora/core-server/ports"
import { framed } from "./framing"
import { type MessageSettings, syslogMessage } from "./message"
import { sendOverStream, sendOverUdp, type TransportSettings } from "./transport"

export { SyslogFramingError } from "./framing"
export { SyslogMessageTooLargeError, SyslogTimeoutError, type TlsMaterial } from "./transport"

export interface SyslogSettings extends MessageSettings, TransportSettings {
	framing: SyslogFraming
}

// ADR-003, ADR-005, CAP-025-R08
export class SyslogAuditSink implements AuditSinkPort {
	constructor(private readonly settings: SyslogSettings) {}

	async export(records: readonly AuditRecord[]): Promise<void> {
		if (records.length === 0) {
			return
		}
		const messages = records.map((record) => syslogMessage(record, this.settings))
		if (this.settings.transport === SYSLOG_TRANSPORT.UDP) {
			await sendOverUdp(messages, this.settings)
			return
		}
		const frames = messages.map((message) => framed(message, this.settings.transport, this.settings.framing))
		await sendOverStream(Buffer.concat(frames), this.settings)
	}
}
