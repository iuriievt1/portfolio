import { CODE_LIST, ERROR_CODE } from "@ansora/contracts"
import { HttpStatus } from "@nestjs/common"
import { describe, expect, it } from "vitest"
import { problemOf } from "../../encounter/__tests__/encounter-fixtures"
import type { CodeListRepository } from "../repositories/code-list.repository"
import type { CodeListSetRepository } from "../repositories/code-list-set.repository"
import { CodeListChoiceService } from "../services/code-list-choice.service"
import type { StoredCodeListItem } from "../types/code-list.types"

const ITEMS: StoredCodeListItem[] = [
	{
		id: "i1",
		codeListCode: "healing-phase",
		code: "granulating",
		sequence: 1,
		isActive: true,
		names: { cs: "Granulační" },
	},
	{ id: "i2", codeListCode: "healing-phase", code: "old", sequence: 2, isActive: false, names: { cs: "Stará" } },
]

const service = new CodeListChoiceService(
	{
		isOffered: async (_sql: never, codeListCode: string, code: string) =>
			ITEMS.some((item) => item.codeListCode === codeListCode && item.code === code && item.isActive),
	} as unknown as CodeListRepository,
	{
		byVersion: async (_sql: never, version: number) =>
			version === 3 ? { id: "s3", version: 3, body_diagram_version: "1" } : undefined,
	} as unknown as CodeListSetRepository,
)

describe("code list item chosen at the bedside CAP-017-R16", () => {
	it("CAP-017-R09 accepts an offered item and answers the version it was chosen by", async () => {
		expect(await service.choose({} as never, CODE_LIST.HEALING_PHASE, "granulating", "3")).toBe(3)
	})

	it("CAP-017-R08 refuses a withdrawn item, which is no longer offered", async () => {
		const problem = await problemOf(service.choose({} as never, CODE_LIST.HEALING_PHASE, "old", "3"))

		expect(problem.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
		expect(problem.code).toBe(ERROR_CODE.RECORD_REJECTED)
	})

	it("refuses a code list version the server never issued", async () => {
		const problem = await problemOf(service.choose({} as never, CODE_LIST.HEALING_PHASE, "granulating", "9"))

		expect(problem.code).toBe(ERROR_CODE.RECORD_REJECTED)
	})
})
