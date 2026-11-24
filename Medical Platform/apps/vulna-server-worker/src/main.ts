import "reflect-metadata"
import { Logger } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import { AppModule } from "./app/app.module"
import { EnvVariable } from "./libs/common/constants/env-variable.constants"
import { EnvVariableService } from "./libs/common/services/env-variable.service"

/**
 * Entry point of the worker process ✓ ADR-005 ř. 37.
 *
 * The same container image as the API process, a different entry point ✓ ADR-005 ř. 37,
 * `docs/spec/architektura.md` kap. 2.
 *
 * The worker assembles artifacts, runs OCR as a short-lived Tesseract subprocess, delivers to
 * the PACS, synchronises the registry, exports the audit trail and runs retention jobs
 * ✓ ADR-005 ř. 37–40.
 *
 * It **listens only for surveillance** — health checks and metrics are kept per process
 * ✓ CAP-028-R06, CAP-028-R08. MOÚ profile adapters add no listening port ✓ ADR-003 ř. 42.
 *
 * The worker has its **own database role** ✓ ADR-005 ř. 37, NAB-464, ADR-021.
 */
async function bootstrap(): Promise<void> {
	const app = await NestFactory.create(AppModule, { bufferLogs: true })
	const env = app.get(EnvVariableService)

	app.enableShutdownHooks()

	const port = Number(env.get(EnvVariable.PORT_WORKER_SURVEILLANCE))
	await app.listen(port)
	new Logger("bootstrap").log(`Worker listening for surveillance on port ${port}`)
}

bootstrap().catch((error: unknown) => {
	Logger.flush()
	new Logger("bootstrap").error("The worker process failed to start", error)
	process.exitCode = 1
})
