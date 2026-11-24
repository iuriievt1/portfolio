import "reflect-metadata"
import { APP_VERSION_HEADER, DPOP_HEADER, ERROR_CODE } from "@ansora/contracts"
import { DEVICE_STATE, type DeviceState, parseVersion } from "@ansora/core-server"
import type { ExecutionContext } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { describe, expect, it } from "vitest"
import type { ConfigurationService } from "../../../configuration/services/configuration.service"
import { DpopNonceRequiredException } from "../../../device/exceptions/dpop-nonce-required.exception"
import type { DeviceProofService } from "../../../device/services/device-proof.service"
import { AcceptsAnyAppVersion } from "../../decorators/accepts-any-app-version.decorator"
import { AcceptsOutdatedAppForDraft } from "../../decorators/accepts-outdated-app-for-draft.decorator"
import { OutsideMobileContract } from "../../decorators/outside-mobile-contract.decorator"
import { ProblemException } from "../../exceptions/problem.exception"
import { AppVersionGuard } from "../app-version.guard"

class MobileController {
	submit(): boolean {
		return true
	}

	@AcceptsAnyAppVersion()
	report(): boolean {
		return true
	}

	@AcceptsOutdatedAppForDraft()
	finishDraft(): boolean {
		return true
	}
}

@OutsideMobileContract()
class HealthController {
	live(): boolean {
		return true
	}
}

function contextOf(controller: object, handler: () => boolean, headers: Record<string, string>): ExecutionContext {
	const request = { header: (name: string) => headers[name] }
	return {
		switchToHttp: () => ({ getRequest: () => request }),
		getHandler: () => handler,
		getClass: () => controller.constructor,
	} as unknown as ExecutionContext
}

const PROOF = "proof"

function guardWithMinimum(minimum: string | undefined, deviceState?: DeviceState): AppVersionGuard {
	const configuration = {
		minimumAppVersion: async () => (minimum === undefined ? undefined : parseVersion(minimum)),
	} as ConfigurationService
	const proofs = {
		ofKnownDevice: async () => {
			if (deviceState === undefined) {
				throw new Error("unknown device")
			}
			return { device: { state: deviceState }, jti: PROOF }
		},
	} as unknown as DeviceProofService
	return new AppVersionGuard(new Reflector(), configuration, proofs)
}

async function rejection(guard: AppVersionGuard, context: ExecutionContext): Promise<ProblemException> {
	const error: unknown = await guard.canActivate(context).catch((caught: unknown) => caught)
	if (!(error instanceof ProblemException)) {
		throw new Error("the guard let the request through")
	}
	return error
}

const mobile = new MobileController()
const health = new HealthController()

describe("minimum app version guard", () => {
	it("CAP-012-S11 rejects an app older than the minimum version with app-version-unsupported", async () => {
		const guard = guardWithMinimum("1.4.0")
		const error = await rejection(guard, contextOf(mobile, mobile.submit, { [APP_VERSION_HEADER]: "1.3.9+7" }))
		expect(error.getStatus()).toBe(403)
		expect(error.code).toBe(ERROR_CODE.APP_VERSION_UNSUPPORTED)
	})

	it("CAP-012-R24 a revoked device gets device-revoked before the version code", async () => {
		const guard = guardWithMinimum("1.4.0", DEVICE_STATE.REVOKED)
		const headers = { [APP_VERSION_HEADER]: "1.3.9+7", [DPOP_HEADER]: PROOF }
		const error = await rejection(guard, contextOf(mobile, mobile.submit, headers))
		expect(error.getStatus()).toBe(403)
		expect(error.code).toBe(ERROR_CODE.DEVICE_REVOKED)
	})

	it("CAP-012-R24 a revoked device first gets the nonce, so it can still learn it was revoked", async () => {
		const proofs = {
			ofKnownDevice: async () => {
				throw new DpopNonceRequiredException("fresh")
			},
		} as unknown as DeviceProofService
		const configuration = { minimumAppVersion: async () => parseVersion("1.4.0") } as ConfigurationService
		const guard = new AppVersionGuard(new Reflector(), configuration, proofs)
		const headers = { [APP_VERSION_HEADER]: "1.3.9+7", [DPOP_HEADER]: PROOF }

		const error = await rejection(guard, contextOf(mobile, mobile.submit, headers))

		expect(error).toBeInstanceOf(DpopNonceRequiredException)
		expect(error.getStatus()).toBe(401)
	})

	it("CAP-012-R24 an approved device gets the version code", async () => {
		const guard = guardWithMinimum("1.4.0", DEVICE_STATE.APPROVED)
		const headers = { [APP_VERSION_HEADER]: "1.3.9+7", [DPOP_HEADER]: PROOF }
		const error = await rejection(guard, contextOf(mobile, mobile.submit, headers))
		expect(error.code).toBe(ERROR_CODE.APP_VERSION_UNSUPPORTED)
	})

	it("CAP-012-R24 an unprovable device gets the version code", async () => {
		const guard = guardWithMinimum("1.4.0")
		const headers = { [APP_VERSION_HEADER]: "1.3.9+7", [DPOP_HEADER]: PROOF }
		const error = await rejection(guard, contextOf(mobile, mobile.submit, headers))
		expect(error.code).toBe(ERROR_CODE.APP_VERSION_UNSUPPORTED)
	})

	it("lets the minimum version and newer through", async () => {
		const guard = guardWithMinimum("1.4.0")
		await expect(
			guard.canActivate(contextOf(mobile, mobile.submit, { [APP_VERSION_HEADER]: "1.4.0+1" })),
		).resolves.toBe(true)
		await expect(
			guard.canActivate(contextOf(mobile, mobile.submit, { [APP_VERSION_HEADER]: "2.0.0+3" })),
		).resolves.toBe(true)
	})

	it("CAP-012-S14 accepts an older app on the operations marked as accepting any version and rejects it elsewhere", async () => {
		const guard = guardWithMinimum("1.4.0")
		const headers = { [APP_VERSION_HEADER]: "1.3.9+7" }
		await expect(guard.canActivate(contextOf(mobile, mobile.report, headers))).resolves.toBe(true)
		const error = await rejection(guard, contextOf(mobile, mobile.submit, headers))
		expect(error.code).toBe(ERROR_CODE.APP_VERSION_UNSUPPORTED)
	})

	it("CAP-012-S16 lets an outdated app finish a started draft and refuses it any other work", async () => {
		const guard = guardWithMinimum("1.4.0", DEVICE_STATE.APPROVED)
		const headers = { [APP_VERSION_HEADER]: "1.3.9+7", [DPOP_HEADER]: PROOF }

		await expect(guard.canActivate(contextOf(mobile, mobile.finishDraft, headers))).resolves.toBe(true)
		const error = await rejection(guard, contextOf(mobile, mobile.submit, headers))
		expect(error.code).toBe(ERROR_CODE.APP_VERSION_UNSUPPORTED)
	})

	it("accepts every version when no minimum is configured", async () => {
		const guard = guardWithMinimum(undefined)
		await expect(
			guard.canActivate(contextOf(mobile, mobile.submit, { [APP_VERSION_HEADER]: "0.0.1+1" })),
		).resolves.toBe(true)
	})

	it("rejects a request without a well-formed version header, even on the exempt operations", async () => {
		const guard = guardWithMinimum(undefined)
		const missing = await rejection(guard, contextOf(mobile, mobile.submit, {}))
		expect(missing.getStatus()).toBe(400)
		expect(missing.code).toBe(ERROR_CODE.RECORD_REJECTED)
		const malformed = await rejection(guard, contextOf(mobile, mobile.report, { [APP_VERSION_HEADER]: "1.0.0" }))
		expect(malformed.getStatus()).toBe(400)
	})

	it("does not require the header outside the mobile contract", async () => {
		const guard = guardWithMinimum("1.4.0")
		await expect(guard.canActivate(contextOf(health, health.live, {}))).resolves.toBe(true)
	})
})
