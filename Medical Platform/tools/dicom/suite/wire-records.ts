import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { routeDirectory } from "../wire/proxy"
import type { ConnectionRecord } from "../wire/recorder"
import type { ClosedBy } from "../wire/relay"

// integrace-dicom.md 9.1, 11.1

export interface WireConnection extends Omit<ConnectionRecord, "pdus"> {
	connection: number
	peer: string
	closedBy: ClosedBy | undefined
	error: string | undefined
	pdusFile: string
}

export function readWireConnections(evidence: string, peer: string): WireConnection[] {
	const path = join(routeDirectory(evidence, peer), "pdus.jsonl")
	if (!existsSync(path)) {
		return []
	}
	return readFileSync(path, "utf8")
		.split("\n")
		.filter((line) => line.length > 0)
		.map((line) => JSON.parse(line) as WireConnection)
}
