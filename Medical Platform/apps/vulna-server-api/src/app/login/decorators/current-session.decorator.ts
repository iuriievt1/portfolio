import { createParamDecorator, type ExecutionContext } from "@nestjs/common"
import type { CurrentSession as CurrentSessionValue, UserSessionRequest } from "../types/login.types"

export const CurrentSession = createParamDecorator((_data: unknown, context: ExecutionContext): CurrentSessionValue => {
	const session = context.switchToHttp().getRequest<UserSessionRequest>().userSession
	if (session === undefined) {
		throw new Error("The user session guard did not run before this handler")
	}
	return session
})
