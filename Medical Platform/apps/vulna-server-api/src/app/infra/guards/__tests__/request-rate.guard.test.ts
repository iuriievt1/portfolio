import { ERROR_CODE, RETRY_AFTER_HEADER } from "@ansora/contracts"
import type { ExecutionContext } from "@nestjs/common"
import { describe, expect, it } from "vitest"
import type { ConfigurationService } from "../../../configuration/services/configuration.service"
import type { DeviceProofService } from "../../../device/services/device-proof.service"
import { DeviceRequestLimitService } from "../../../request-rate/services/device-request-limit.service"
import { RequestRateService } from "../../../request-rate/services/request-rate.service"
import { ProblemException } from "../../exceptions/problem.exception"
import { RequestRateGuard } from "../request-rate.guard"

const CONTEXT = { switchToHttp: () => ({ getRequest: () => ({}) }) } as unknown as ExecutionContext

function guardFor(deviceKey: string | undefined, limit: number): RequestRateGuard {
	const proofs = { signedHardwareId: () => deviceKey } as unknown as DeviceProofService
	const configuration = { integer: async () => limit } as unknown as ConfigurationService
	return new RequestRateGuard(proofs, new DeviceRequestLimitService(configuration, new RequestRateService()))
}

describe("request rate guard", () => {
	it("answers 429 retry with Retry-After once a device runs over its limit", async () => {
		const guard = guardFor("device-a", 1)
		await expect(guard.canActivate(CONTEXT)).resolves.toBe(true)
		const error: unknown = await guard.canActivate(CONTEXT).catch((caught: unknown) => caught)
		if (!(error instanceof ProblemException)) {
			throw new Error("the guard let the request through")
		}
		expect(error.getStatus()).toBe(429)
		expect(error.code).toBe(ERROR_CODE.RETRY)
		expect(Number(error.headers[RETRY_AFTER_HEADER])).toBeGreaterThan(0)
	})

	it("does not count a request without a signed device proof", async () => {
		const guard = guardFor(undefined, 0)
		await expect(guard.canActivate(CONTEXT)).resolves.toBe(true)
	})
})
