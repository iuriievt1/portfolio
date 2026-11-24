import "reflect-metadata"
import { ADMIN_API_BASE_PATH, API_BASE_PATH, DPOP_NONCE_HEADER, ERROR_CODE } from "@ansora/contracts"
import { Controller, Get, HttpStatus, Inject, type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import type { NestExpressApplication } from "@nestjs/platform-express"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { DpopNonceService } from "../../../device/services/dpop-nonce.service"
import { ProblemException } from "../../exceptions/problem.exception"
import { applyApiPrefix } from "../../hosting/api-prefix"
import { DpopNonceMiddleware, EVERY_ROUTE } from "../dpop-nonce.middleware"

@Controller("ping")
class MobileController {
	@Get()
	answer(): { ok: boolean } {
		return { ok: true }
	}

	@Get("refused")
	refuse(): never {
		throw new ProblemException(HttpStatus.UNAUTHORIZED, ERROR_CODE.SIGN_IN_AGAIN)
	}
}

@Controller(`${ADMIN_API_BASE_PATH}/ping`)
class AdministrationController {
	@Get()
	answer(): { ok: boolean } {
		return { ok: true }
	}
}

@Module({ controllers: [MobileController, AdministrationController], providers: [DpopNonceService] })
class NonceTestModule implements NestModule {
	constructor(@Inject(DpopNonceService) private readonly nonces: DpopNonceService) {}

	configure(consumer: MiddlewareConsumer): void {
		const middleware = new DpopNonceMiddleware(this.nonces)
		consumer.apply(middleware.use.bind(middleware)).forRoutes(EVERY_ROUTE)
	}
}

let app: NestExpressApplication
let baseUrl: string

beforeAll(async () => {
	app = await NestFactory.create<NestExpressApplication>(NonceTestModule, { logger: false })
	applyApiPrefix(app)
	await app.listen(0)
	baseUrl = await app.getUrl()
})

afterAll(async () => {
	await app.close()
})

describe("DpopNonceMiddleware", () => {
	it("Q-082 sends the current nonce with every answer of the mobile API", async () => {
		const answered = await fetch(`${baseUrl}${API_BASE_PATH}/ping`)
		const refused = await fetch(`${baseUrl}${API_BASE_PATH}/ping/refused`)
		const current = app.get(DpopNonceService).current()

		expect(answered.status).toBe(200)
		expect(answered.headers.get(DPOP_NONCE_HEADER)).toBe(current)
		expect(refused.status).toBe(401)
		expect(refused.headers.get(DPOP_NONCE_HEADER)).toBe(current)
	})

	it("sends no nonce to the administration, which signs nothing with a device key", async () => {
		const answered = await fetch(`${baseUrl}${ADMIN_API_BASE_PATH}/ping`)

		expect(answered.status).toBe(200)
		expect(answered.headers.get(DPOP_NONCE_HEADER)).toBeNull()
	})
})
