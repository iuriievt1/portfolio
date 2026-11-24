import type { Session } from "@ansora/core-mobile"
import { describe, expect, it } from "vitest"
import { hasRole } from "../access-rule"

function sessionWith(roles: Session["user"]["roles"]): Session {
	return { user: { roles } } as Session
}

describe("hasRole", () => {
	it("CAP-003-S04 sends a user without any role to the administrator", () => {
		expect(hasRole(sessionWith([]))).toBe(false)
	})

	it("lets a clinician into the app", () => {
		expect(hasRole(sessionWith(["clinician"]))).toBe(true)
	})
})
