import { createServer } from "node:http"
import { HEALTH_PATH, SURVEILLANCE_METRICS_PATH } from "@ansora/core-server"
import { HttpStatus } from "@nestjs/common"
import type { NestExpressApplication } from "@nestjs/platform-express"
import type { NextFunction, Request, Response } from "express"

const HEALTH_PREFIX = `/${HEALTH_PATH}/`
const METRICS = `/${SURVEILLANCE_METRICS_PATH}`

// provoz-a-dohled.md 7.2, CAP-028-R08
export function isSurveillancePath(path: string): boolean {
	return path.startsWith(HEALTH_PREFIX) || path === METRICS
}

// CAP-028-R08
export function restrictToSurveillance(app: NestExpressApplication, port: number): void {
	app.use((request: Request, response: Response, next: NextFunction) => {
		if (request.socket.localPort !== port || isSurveillancePath(request.path)) {
			next()
			return
		}
		response.status(HttpStatus.NOT_FOUND).end()
	})
}

// provoz-a-dohled.md 7.2, CAP-028-R06
export async function listenForSurveillance(app: NestExpressApplication, port: number): Promise<void> {
	const server = createServer(app.getHttpAdapter().getInstance())
	app.getHttpServer().on("close", () => server.close())
	await new Promise<void>((resolve, reject) => {
		server.once("error", reject)
		server.listen(port, resolve)
	})
}
