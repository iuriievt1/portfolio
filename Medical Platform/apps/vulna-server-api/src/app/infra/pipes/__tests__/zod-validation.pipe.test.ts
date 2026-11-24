import { ERROR_CODE } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import { ProblemException } from "../../exceptions/problem.exception"
import { ZodValidationPipe } from "../zod-validation.pipe"

const pipe = new ZodValidationPipe(z.strictObject({ reason: z.string().min(1) }))

describe("zod validation pipe", () => {
	it("returns the parsed body when it matches the schema", () => {
		expect(pipe.transform({ reason: "x" })).toEqual({ reason: "x" })
	})

	it("rejects a body that does not match with 400 and the problems in detail", () => {
		let error: unknown
		try {
			pipe.transform({ reason: "", extra: 1 })
		} catch (caught) {
			error = caught
		}
		expect(error).toBeInstanceOf(ProblemException)
		const problem = error as ProblemException
		expect(problem.getStatus()).toBe(400)
		expect(problem.code).toBe(ERROR_CODE.RECORD_REJECTED)
		expect(problem.detail).toContain("reason")
	})
})
