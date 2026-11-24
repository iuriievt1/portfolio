import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { PROFILE_ARTIFACT, type Schema } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"

const PROFILE_DIRECTORY = resolve(__dirname, "../../../../../dist/profile")

// ADR-035
@Injectable()
export class ProfileService {
	readonly configurationSchema: Schema = JSON.parse(
		readFileSync(join(PROFILE_DIRECTORY, PROFILE_ARTIFACT.CONFIGURATION_SCHEMA), "utf8"),
	) as Schema
}
