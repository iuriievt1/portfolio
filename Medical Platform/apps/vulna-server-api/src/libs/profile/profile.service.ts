import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { PROFILE_ARTIFACT, type Schema } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"

const PROFILE_DIRECTORY = resolve(__dirname, "../../../../../dist/profile")

function readJson<T>(file: string): T {
	return JSON.parse(readFileSync(join(PROFILE_DIRECTORY, file), "utf8")) as T
}

@Injectable()
export class ProfileService {
	readonly configurationSchema: Schema
	readonly outboundTargetKeys: readonly string[]

	constructor() {
		this.configurationSchema = readJson<Schema>(PROFILE_ARTIFACT.CONFIGURATION_SCHEMA)
		this.outboundTargetKeys = readJson<string[]>(PROFILE_ARTIFACT.OUTBOUND_TARGETS)
	}
}
