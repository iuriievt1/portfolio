import { ADMIN_API_BASE_PATH } from "@ansora/contracts"
import type { CookieOptions } from "express"

export const ADMINISTRATION_HOME = "/"

// CAP-004-R05
export function administrationSessionCookie(expiresAt: Date | undefined): CookieOptions {
	return { httpOnly: true, secure: true, sameSite: "strict", path: ADMIN_API_BASE_PATH, expires: expiresAt }
}
