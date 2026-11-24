import { ERROR_CODE } from "@ansora/contracts"
import { HttpStatus, Injectable, type PipeTransform } from "@nestjs/common"
import type { ZodType } from "zod"
import { ProblemException } from "../exceptions/problem.exception"

@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
	constructor(private readonly schema: ZodType<T>) {}

	transform(value: unknown): T {
		const result = this.schema.safeParse(value)
		if (!result.success) {
			const detail = result.error.issues
				.map((issue) => `${issue.path.map(String).join(".")}: ${issue.message}`)
				.join("; ")
			throw new ProblemException(HttpStatus.BAD_REQUEST, ERROR_CODE.RECORD_REJECTED, detail)
		}
		return result.data
	}
}
