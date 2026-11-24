import type { NestExpressApplication } from "@nestjs/platform-express"
import type { NextFunction, Request, Response } from "express"
import { describe, expect, it } from "vitest"
import { isSurveillancePath, restrictToSurveillance } from "../surveillance-listener"

const SURVEILLANCE_PORT = 3001

type Middleware = (request: Request, response: Response, next: NextFunction) => void

function registeredMiddleware(): Middleware {
	let registered: Middleware | undefined
	restrictToSurveillance(
		{ use: (middleware: Middleware) => (registered = middleware) } as unknown as NestExpressApplication,
		SURVEILLANCE_PORT,
	)
	if (registered === undefined) {
		throw new Error("no middleware")
	}
	return registered
}

function run(middleware: Middleware, port: number, path: string): number | "next" {
	let outcome: number | "next" = "next"
	const response = {
		status: (status: number) => {
			outcome = status
			return { end: () => undefined }
		},
	} as unknown as Response
	middleware({ socket: { localPort: port }, path } as unknown as Request, response, () => undefined)
	return outcome
}

describe("surveillance listener of the API", () => {
	it("CAP-028-R08 knows the health endpoints and the metrics", () => {
		expect(isSurveillancePath("/health/live")).toBe(true)
		expect(isSurveillancePath("/health/dependencies")).toBe(true)
		expect(isSurveillancePath("/metrics")).toBe(true)
		expect(isSurveillancePath("/api/v1/metrics")).toBe(false)
		expect(isSurveillancePath("/api/v1/session")).toBe(false)
		expect(isSurveillancePath("/api/admin/v1/monitoring/metrics")).toBe(false)
		expect(isSurveillancePath("/")).toBe(false)
	})

	it("CAP-028-R08 serves nothing else on the reserved port and leaves the public port alone", () => {
		const middleware = registeredMiddleware()

		expect(run(middleware, SURVEILLANCE_PORT, "/metrics")).toBe("next")
		expect(run(middleware, SURVEILLANCE_PORT, "/api/v1/device/registration")).toBe(404)
		expect(run(middleware, SURVEILLANCE_PORT, "/")).toBe(404)
		expect(run(middleware, 3000, "/api/v1/device/registration")).toBe("next")
	})
})
