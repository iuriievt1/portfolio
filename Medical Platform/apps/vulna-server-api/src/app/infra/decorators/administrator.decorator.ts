import { createParamDecorator, type ExecutionContext } from "@nestjs/common"
import type {
	AdministrationRequest,
	AdministrationSession,
} from "../../administration-session/types/administration-session.types"

export const Administrator = createParamDecorator(
	(_data: unknown, context: ExecutionContext): AdministrationSession => {
		const session = context.switchToHttp().getRequest<AdministrationRequest>().administrationSession
		if (session === undefined) {
			throw new Error("The administration session guard did not run before this handler")
		}
		return session
	},
)
