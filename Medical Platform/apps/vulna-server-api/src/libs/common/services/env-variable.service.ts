import { Injectable } from "@nestjs/common"
import type { EnvVariable } from "../constants/env-variable.constants"

/**
 * The single place that reads `process.env`.
 *
 * Secrets are never in the code ✓ NAB-465; the deployment supplies them to the process according
 * to the profile ✓ ADR-019.
 */
@Injectable()
export class EnvVariableService {
	/** Throws when the variable is missing — the process must not start half-configured. */
	get(variable: EnvVariable): string {
		const value = process.env[variable]
		if (value === undefined || value === "") {
			throw new Error(`Missing required environment variable ${variable}`)
		}
		return value
	}

	getOptional(variable: EnvVariable): string | undefined {
		const value = process.env[variable]
		return value === "" ? undefined : value
	}
}
