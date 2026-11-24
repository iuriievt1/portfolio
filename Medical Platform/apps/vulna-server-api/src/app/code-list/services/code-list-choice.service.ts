import { type CodeListCode, ERROR_CODE } from "@ansora/contracts"
import { codeListSetVersionOf } from "@ansora/core-server"
import { HttpStatus, Injectable } from "@nestjs/common"
import type { Executor } from "../../../libs/database/database.service"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { CodeListRepository } from "../repositories/code-list.repository"
import { CodeListSetRepository } from "../repositories/code-list-set.repository"

// CAP-017-R08, CAP-017-R09, CAP-017-R16, CAP-017-R20
@Injectable()
export class CodeListChoiceService {
	constructor(
		private readonly codeLists: CodeListRepository,
		private readonly sets: CodeListSetRepository,
	) {}

	async choose(sql: Executor, codeListCode: CodeListCode, code: string, codeListVersion: string): Promise<number> {
		const version = codeListSetVersionOf(codeListVersion)
		if (version === undefined || (await this.sets.byVersion(sql, version)) === undefined) {
			throw new ProblemException(
				HttpStatus.UNPROCESSABLE_ENTITY,
				ERROR_CODE.RECORD_REJECTED,
				`unknown code list set version ${codeListVersion}`,
			)
		}
		if (!(await this.codeLists.isOffered(sql, codeListCode, code))) {
			throw new ProblemException(
				HttpStatus.UNPROCESSABLE_ENTITY,
				ERROR_CODE.RECORD_REJECTED,
				`${code} is not offered in the code list ${codeListCode}`,
			)
		}
		return version
	}
}
