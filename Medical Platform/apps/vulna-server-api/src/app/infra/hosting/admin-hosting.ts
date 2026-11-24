import { existsSync } from "node:fs"
import { extname, join, resolve } from "node:path"
import type { NestExpressApplication } from "@nestjs/platform-express"
import type { NextFunction, Request, Response } from "express"
import { isSurveillancePath } from "./surveillance-listener"

const API_PREFIX = "/api/"

export function isAppRoute(method: string, path: string): boolean {
	return method === "GET" && !path.startsWith(API_PREFIX) && !isSurveillancePath(path) && extname(path) === ""
}

export function hostAdminApp(app: NestExpressApplication, directory: string): void {
	const root = resolve(directory)
	const index = join(root, "index.html")
	if (!existsSync(index)) {
		throw new Error(`Admin build not found: ${index}`)
	}

	app.useStaticAssets(root, { index: false, redirect: false })
	app.use((request: Request, response: Response, next: NextFunction) => {
		if (!isAppRoute(request.method, request.path)) {
			next()
			return
		}
		response.sendFile(index)
	})
}
