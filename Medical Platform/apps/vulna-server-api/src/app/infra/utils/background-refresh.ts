import { BACKGROUND_REFRESH, BACKGROUND_REFRESH_HEADER } from "@ansora/contracts"
import type { Request } from "express"
import { SAFE_METHODS } from "./cross-site-request"

// CAP-004-R11, CAP-028-R14, administration.yaml BackgroundRefresh
export function isBackgroundRefresh(request: Request): boolean {
	return SAFE_METHODS.has(request.method) && request.get(BACKGROUND_REFRESH_HEADER) === BACKGROUND_REFRESH
}
