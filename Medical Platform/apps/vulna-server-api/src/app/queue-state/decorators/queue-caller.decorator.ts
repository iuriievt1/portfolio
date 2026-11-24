import { createParamDecorator, type ExecutionContext } from "@nestjs/common"
import type { QueueCallerRequest, QueueCaller as QueueCallerValue } from "../types/queue-state.types"

export const QueueCaller = createParamDecorator((_data: unknown, context: ExecutionContext): QueueCallerValue => {
	const caller = context.switchToHttp().getRequest<QueueCallerRequest>().queueCaller
	if (caller === undefined) {
		throw new Error("The queue caller guard did not run before this handler")
	}
	return caller
})
