import "reflect-metadata"
import { API_BASE_PATH, SIGNED_BODY_CONTENT_TYPE } from "@ansora/contracts"
import { Logger } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import type { NestExpressApplication } from "@nestjs/platform-express"
import { AppModule } from "./app/app.module"
import { hostAdminApp } from "./app/infra/hosting/admin-hosting"
import { applyApiPrefix } from "./app/infra/hosting/api-prefix"
import { listenForSurveillance, restrictToSurveillance } from "./app/infra/hosting/surveillance-listener"
import { EnvVariable } from "./libs/common/constants/env-variable.constants"
import { EnvVariableService } from "./libs/common/services/env-variable.service"
import { optionalPortOf } from "./libs/common/utils/optional-port"
import { parseTrustProxyHops } from "./libs/common/utils/trust-proxy"

const SIGNED_BODY_LIMIT = "16kb"

// ADR-005, NAB-046, NAB-062
async function bootstrap(): Promise<void> {
	const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true })
	try {
		await start(app)
	} catch (error) {
		await app.close()
		throw error
	}
}

async function start(app: NestExpressApplication): Promise<void> {
	const env = app.get(EnvVariableService)
	const port = Number(env.get(EnvVariable.PORT_API))
	const surveillancePort = optionalPortOf(env.getOptional(EnvVariable.PORT_API_SURVEILLANCE))
	// CAP-028-R08
	if (surveillancePort === port) {
		throw new Error("The surveillance port must differ from the API port")
	}

	applyApiPrefix(app)
	const trustedProxies = parseTrustProxyHops(env.getOptional(EnvVariable.TRUST_PROXY))
	if (trustedProxies !== undefined) {
		app.set("trust proxy", trustedProxies)
	}
	app.useBodyParser("text", { type: SIGNED_BODY_CONTENT_TYPE, limit: SIGNED_BODY_LIMIT })
	app.enableShutdownHooks()

	if (surveillancePort !== undefined) {
		restrictToSurveillance(app, surveillancePort)
	}

	const adminPath = env.getOptional(EnvVariable.ADMIN_STATIC_PATH)
	if (adminPath !== undefined) {
		hostAdminApp(app, adminPath)
	}

	await app.listen(port)
	new Logger("bootstrap").log(`API process listening on port ${port}, base path ${API_BASE_PATH}`)
	if (surveillancePort !== undefined) {
		await listenForSurveillance(app, surveillancePort)
		new Logger("bootstrap").log(`API process listening for surveillance on port ${surveillancePort}`)
	}
}

bootstrap().catch((error: unknown) => {
	Logger.flush()
	new Logger("bootstrap").error("The API process failed to start", error)
	process.exitCode = 1
})
