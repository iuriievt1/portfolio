import { createParamDecorator, type ExecutionContext, SetMetadata } from "@nestjs/common"
import { ACCEPTS_UPLOAD_PERMISSION } from "../constants/queue-sender.constants"
import type { QueueSenderRequest, QueueSender as QueueSenderValue } from "../types/queue-sender.types"

export const QueueSender = createParamDecorator((_data: unknown, context: ExecutionContext): QueueSenderValue => {
	const sender = context.switchToHttp().getRequest<QueueSenderRequest>().queueSender
	if (sender === undefined) {
		throw new Error("The queue sender guard did not run before this handler")
	}
	return sender
})

// ADR-014
export const AcceptsUploadPermission = (): MethodDecorator => SetMetadata(ACCEPTS_UPLOAD_PERMISSION, true)
