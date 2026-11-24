import { ERROR_CODE } from "@ansora/contracts"
import { HttpStatus } from "@nestjs/common"
import { describe, expect, it } from "vitest"
import type { DatabaseService } from "../../../libs/database/database.service"
import { ENCOUNTER, problemOf, USER } from "../../encounter/__tests__/encounter-fixtures"
import { encodePageCursor } from "../../infra/utils/page-cursor"
import { AcquisitionDraftRepository } from "../repositories/acquisition-draft.repository"

const PAGE_LIMIT = 10
const BROKEN_MOMENT_CURSOR = encodePageCursor({ sortKey: "yesterday", id: USER })
const NOT_A_CURSOR = "not-a-cursor"

function repository(): AcquisitionDraftRepository {
	const sql = Object.assign(async () => [], {})
	return new AcquisitionDraftRepository({ sql } as unknown as DatabaseService)
}

// ADR-012, index.yaml Cursor, Error400
describe("cursor of the draft lists", () => {
	it("CAP-015-R29 refuses a cursor whose moment is broken instead of failing the query", async () => {
		const problem = await problemOf(repository().listOwnDrafts(USER, BROKEN_MOMENT_CURSOR, PAGE_LIMIT))

		expect(problem.getStatus()).toBe(HttpStatus.BAD_REQUEST)
		expect(problem.code).toBe(ERROR_CODE.RECORD_REJECTED)
	})

	it("CAP-014-R22 refuses a value that is not a cursor of the visit content", async () => {
		const problem = await problemOf(
			repository().listVisibleInEncounter(
				ENCOUNTER,
				{ userId: USER, closedAcquisitionIds: [] },
				NOT_A_CURSOR,
				PAGE_LIMIT,
			),
		)

		expect(problem.getStatus()).toBe(HttpStatus.BAD_REQUEST)
	})

	it("reads the first page without a cursor", async () => {
		expect(await repository().listOwnDrafts(USER, undefined, PAGE_LIMIT)).toEqual({ rows: [], nextCursor: null })
	})
})
