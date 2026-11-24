import { readFileSync } from "node:fs"
import { hostname } from "node:os"
import { SYSLOG_FORMAT, SYSLOG_FRAMING, SYSLOG_TRANSPORT } from "@ansora/contracts"
import { CONFIGURATION_KEY, requiredChoiceOf, requiredIntegerOf, textValueOf } from "@ansora/core-server"
import type { SyslogSettings, TlsMaterial } from "@ansora/vulna-adapter-syslog"
import { Injectable } from "@nestjs/common"
import { EnvVariable } from "../../../libs/common/constants/env-variable.constants"
import { EnvVariableService } from "../../../libs/common/services/env-variable.service"
import { ConfigurationService } from "../../../libs/configuration/configuration.service"

const FORMATS = Object.values(SYSLOG_FORMAT)
const TRANSPORTS = Object.values(SYSLOG_TRANSPORT)
const FRAMINGS = Object.values(SYSLOG_FRAMING)

function fileOf(env: EnvVariableService, variable: EnvVariable): Buffer | undefined {
	const path = env.getOptional(variable)
	return path === undefined ? undefined : readFileSync(path)
}

// konfigurace-a-profily.md 2.1, NAB-465
@Injectable()
export class SyslogSettingsService {
	private readonly tls: TlsMaterial

	constructor(
		private readonly configuration: ConfigurationService,
		env: EnvVariableService,
	) {
		this.tls = {
			ca: fileOf(env, EnvVariable.SYSLOG_TLS_CA_PATH),
			cert: fileOf(env, EnvVariable.SYSLOG_TLS_CERT_PATH),
			key: fileOf(env, EnvVariable.SYSLOG_TLS_KEY_PATH),
		}
	}

	async current(): Promise<SyslogSettings | undefined> {
		const values = await this.configuration.effectiveValues()
		const host = textValueOf(values, CONFIGURATION_KEY.SYSLOG_HOST)
		if (host === undefined) {
			return undefined
		}
		return {
			host,
			port: requiredIntegerOf(values, CONFIGURATION_KEY.SYSLOG_PORT),
			format: requiredChoiceOf(values, CONFIGURATION_KEY.SYSLOG_FORMAT, FORMATS),
			transport: requiredChoiceOf(values, CONFIGURATION_KEY.SYSLOG_TRANSPORT, TRANSPORTS),
			framing: requiredChoiceOf(values, CONFIGURATION_KEY.SYSLOG_FRAMING, FRAMINGS),
			enterpriseNumber: requiredIntegerOf(values, CONFIGURATION_KEY.SYSLOG_ENTERPRISE_NUMBER),
			hostname: hostname(),
			tls: this.tls,
		}
	}
}
