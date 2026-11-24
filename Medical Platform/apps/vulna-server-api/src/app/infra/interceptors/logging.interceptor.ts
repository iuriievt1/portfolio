import { type CallHandler, type ExecutionContext, Injectable, Logger, type NestInterceptor } from "@nestjs/common"
import type { Request } from "express"
import type { Observable } from "rxjs"
import { tap } from "rxjs/operators"

/**
 * Operational request log ✓ NAB-307.
 *
 * Personal data and acquisition content do not belong in the operational log; the audit trail is
 * kept by the core and owned by CAP-025. No telemetry leaves the customer's network ✓ NAB-474.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
	private readonly logger = new Logger("request")

	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		const request = context.switchToHttp().getRequest<Request>()
		const startedAt = Date.now()

		return next.handle().pipe(
			tap(() => {
				this.logger.log(`${request.method} ${request.url} ${Date.now() - startedAt} ms`)
			}),
		)
	}
}
