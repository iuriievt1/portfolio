import { z } from "zod"
import type { SessionRefreshInput } from "../types/login.types"

const USER_SCOPE = "user" satisfies SessionRefreshInput["scope"]

export const sessionRefreshSchema = z.strictObject({
	scope: z.literal(USER_SCOPE).default(USER_SCOPE),
	session_id: z.string().uuid(),
}) satisfies z.ZodType<SessionRefreshInput, SessionRefreshInput | Omit<SessionRefreshInput, "scope">>

export type SessionRefreshDto = SessionRefreshInput
