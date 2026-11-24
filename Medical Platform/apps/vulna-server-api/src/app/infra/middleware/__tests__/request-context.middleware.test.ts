import type { NextFunction, Request, Response } from "express"
import { describe, expect, it } from "vitest"
import { normalizedAddress, requestSourceAddress } from "../../request-context/request-context"
import { RequestContextMiddleware } from "../request-context.middleware"

describe("request context", () => {
	it("CAP-025-R04 keeps the source address of the request for everything the request does", async () => {
		const seen = await new Promise<string | undefined>((resolve) => {
			const next: NextFunction = () => {
				setTimeout(() => resolve(requestSourceAddress()), 0)
			}
			new RequestContextMiddleware().use({ ip: "::ffff:192.0.2.10" } as Request, {} as Response, next)
		})
		expect(seen).toBe("192.0.2.10")
		expect(requestSourceAddress()).toBeUndefined()
	})

	it("keeps an IPv6 address and drops an empty one", () => {
		expect(normalizedAddress("2001:db8::1")).toBe("2001:db8::1")
		expect(normalizedAddress("")).toBeUndefined()
		expect(normalizedAddress(undefined)).toBeUndefined()
	})
})
