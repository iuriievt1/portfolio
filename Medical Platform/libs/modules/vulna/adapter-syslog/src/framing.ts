import { SYSLOG_FRAMING, SYSLOG_TRANSPORT, type SyslogFraming, type SyslogTransport } from "@ansora/core-server/ports"

const LINE_FEED = 0x0a
const NEWLINE = Buffer.from("\n", "utf8")

export class SyslogFramingError extends Error {
	constructor() {
		super("a message with a line feed cannot be framed by a line feed")
		this.name = "SyslogFramingError"
	}
}

// RFC 5425 4.3, RFC 6587 3.4
export function framed(message: Buffer, transport: SyslogTransport, framing: SyslogFraming): Buffer {
	if (transport === SYSLOG_TRANSPORT.TCP && framing === SYSLOG_FRAMING.NON_TRANSPARENT) {
		if (message.includes(LINE_FEED)) {
			throw new SyslogFramingError()
		}
		return Buffer.concat([message, NEWLINE])
	}
	return Buffer.concat([Buffer.from(`${message.byteLength} `, "utf8"), message])
}
