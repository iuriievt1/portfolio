import { CLAIMED_TASK_ALIAS, JOB_STATE } from "@ansora/core-server"
import { describe, expect, it } from "vitest"
import type { DatabaseService } from "../../../libs/database/database.service"
import { UPLOAD_JOB_KIND } from "../constants/clinical-record-upload.constants"
import { UploadTaskRepository } from "../repositories/upload-task.repository"

interface Fragment {
	text: string
	values: unknown[]
}

function isTemplate(value: unknown): value is TemplateStringsArray {
	return Array.isArray(value) && Object.hasOwn(value, "raw")
}

function fakeDatabase(): DatabaseService {
	const sql = (first: unknown, ...rest: unknown[]): Fragment | { helper: unknown } => {
		if (!isTemplate(first)) {
			return { helper: first }
		}
		return { text: first.join("?").replace(/\s+/g, " ").trim(), values: rest }
	}
	return { sql } as unknown as DatabaseService
}

describe("claim of upload tasks ADR-016 ř. 54, datovy-model.md 4", () => {
	it("CAP-021-R40 claims the upload of a file only once its viewing copy is no longer waiting or running", () => {
		const rule = new UploadTaskRepository(fakeDatabase()).claimRuleOf(UPLOAD_JOB_KIND.BINARY_UPLOAD)

		const condition = rule.condition as unknown as Fragment
		expect(rule.kind).toBe(UPLOAD_JOB_KIND.BINARY_UPLOAD)
		expect(rule.objectKinds).toEqual(["image", "document_page", "document"])
		expect(condition.text).toContain("NOT EXISTS ( SELECT 1 FROM queue_task copy WHERE copy.kind = ?")
		expect(condition.text).toContain("copy.object_kind = ?.object_kind AND copy.object_id = ?.object_id")
		expect(condition.values).toEqual([
			UPLOAD_JOB_KIND.VIEWING_COPY,
			{ helper: CLAIMED_TASK_ALIAS },
			{ helper: CLAIMED_TASK_ALIAS },
			JOB_STATE.WAITING,
			JOB_STATE.RUNNING,
		])
	})

	it("CAP-021-R40 claims a viewing copy without waiting for another task", () => {
		const rule = new UploadTaskRepository(fakeDatabase()).claimRuleOf(UPLOAD_JOB_KIND.VIEWING_COPY)

		expect(rule).toEqual({
			kind: UPLOAD_JOB_KIND.VIEWING_COPY,
			objectKinds: ["image", "document_page"],
			condition: undefined,
			countsAttempts: true,
		})
	})
})
