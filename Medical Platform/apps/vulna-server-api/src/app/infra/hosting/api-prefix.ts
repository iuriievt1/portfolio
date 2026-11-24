import { ADMIN_API_BASE_PATH, API_BASE_PATH } from "@ansora/contracts"
import { HEALTH_PATH, SURVEILLANCE_METRICS_PATH } from "@ansora/core-server"
import { type INestApplication, RequestMethod } from "@nestjs/common"

export function applyApiPrefix(app: INestApplication): void {
	app.setGlobalPrefix(API_BASE_PATH, {
		exclude: [
			{ path: `${ADMIN_API_BASE_PATH}/*path`, method: RequestMethod.ALL },
			// CAP-028, provoz-a-dohled.md 2
			{ path: `${HEALTH_PATH}/*path`, method: RequestMethod.GET },
			{ path: SURVEILLANCE_METRICS_PATH, method: RequestMethod.GET },
		],
	})
}
