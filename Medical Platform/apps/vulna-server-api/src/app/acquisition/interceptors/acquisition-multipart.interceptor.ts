import { CONFIGURATION_KEY } from "@ansora/core-server"
import {
	type CallHandler,
	type ExecutionContext,
	Inject,
	Injectable,
	mixin,
	type NestInterceptor,
	type Type,
} from "@nestjs/common"
import { FileFieldsInterceptor } from "@nestjs/platform-express"
import type { Request } from "express"
import type { Observable } from "rxjs"
import { ConfigurationService } from "../../configuration/services/configuration.service"
import { MULTIPART_COUNT_LIMITS } from "../constants/acquisition-file.constants"
import type { MultipartPart } from "../types/acquisition-file.types"
import { tooLarge } from "../utils/acquisition-problems"
import { declaredLengthOf } from "../utils/declared-length"

// CAP-015-R13, konfigurace-a-profily.md 2.7, clinical-workflow.yaml uploadImage 413
export function AcquisitionMultipartInterceptor(parts: readonly MultipartPart[]): Type<NestInterceptor> {
	@Injectable()
	class MultipartInterceptor implements NestInterceptor {
		private readonly readers = new Map<number, NestInterceptor>()

		constructor(@Inject(ConfigurationService) private readonly configuration: ConfigurationService) {}

		async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
			const maxBytes = await this.configuration.integer(CONFIGURATION_KEY.ACQUISITION_MAX_BYTES)
			const declaredLength = declaredLengthOf(context.switchToHttp().getRequest<Request>())
			if (declaredLength !== undefined && declaredLength > maxBytes) {
				throw tooLarge(`the request body is larger than ${maxBytes} bytes`)
			}
			return await this.readerOf(maxBytes).intercept(context, next)
		}

		private readerOf(maxBytes: number): NestInterceptor {
			const known = this.readers.get(maxBytes)
			if (known !== undefined) {
				return known
			}
			const Reader = FileFieldsInterceptor([...parts], { limits: { ...MULTIPART_COUNT_LIMITS, fileSize: maxBytes } })
			const reader = new Reader()
			this.readers.set(maxBytes, reader)
			return reader
		}
	}
	return mixin(MultipartInterceptor)
}
