import { SURVEILLANCE_ACCESS } from "@ansora/core-server"
import type { Request } from "express"
import { describe, expect, it } from "vitest"
import type { EnvVariableService } from "../../../libs/common/services/env-variable.service"
import { SurveillanceAccessService } from "../services/surveillance-access.service"

const TOKEN = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6"
const MAIN_PORT = 3000
const SURVEILLANCE_PORT = 3001

function serviceWith(values: Readonly<Record<string, string>>): SurveillanceAccessService {
	return new SurveillanceAccessService({ getOptional: (name: string) => values[name] } as unknown as EnvVariableService)
}

function requestOn(port: number, authorization?: string): Request {
	return { socket: { localPort: port }, headers: { authorization } } as unknown as Request
}

describe("SurveillanceAccessService", () => {
	it("CAP-028-S05 keeps the details off the public port of the API without a token", () => {
		const service = serviceWith({ PORT_API_SURVEILLANCE: String(SURVEILLANCE_PORT) })

		expect(service.accessOf(requestOn(MAIN_PORT))).toBe(SURVEILLANCE_ACCESS.NOT_EXPOSED)
		expect(service.accessOf(requestOn(SURVEILLANCE_PORT))).toBe(SURVEILLANCE_ACCESS.GRANTED)
	})

	it("CAP-028-R08 asks every client for the token once the installation chose it", () => {
		const service = serviceWith({ PORT_API_SURVEILLANCE: String(SURVEILLANCE_PORT), SURVEILLANCE_TOKEN: TOKEN })

		expect(service.accessOf(requestOn(SURVEILLANCE_PORT))).toBe(SURVEILLANCE_ACCESS.UNAUTHENTICATED)
		expect(service.accessOf(requestOn(MAIN_PORT, `Bearer ${TOKEN}`))).toBe(SURVEILLANCE_ACCESS.GRANTED)
	})

	it("exposes nothing when the installation set neither a token nor a reserved port", () => {
		expect(serviceWith({}).accessOf(requestOn(MAIN_PORT))).toBe(SURVEILLANCE_ACCESS.NOT_EXPOSED)
	})

	it("refuses to start with a token that is too short", () => {
		expect(() => serviceWith({ SURVEILLANCE_TOKEN: "short" })).toThrow()
	})
})
