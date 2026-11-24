import { CODE_LIST } from "@ansora/contracts"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { CodeListChoiceService } from "../../code-list/services/code-list-choice.service"
import type { DocumentTitleInput } from "../dto/acquisition-draft-update.input.dto"
import type { DocumentTitleChoice } from "../types/acquisition-file.types"

// CAP-018-R15, CAP-017-R08, CAP-017-R09, CAP-017-R16
@Injectable()
export class DocumentTitleService {
	constructor(private readonly choices: CodeListChoiceService) {}

	async check(tx: postgres.TransactionSql, title: DocumentTitleInput): Promise<DocumentTitleChoice> {
		if (title.code === undefined || title.code_list_version === undefined) {
			return { code: null, text: title.text ?? null, codeListVersion: null }
		}
		const version = await this.choices.choose(tx, CODE_LIST.DOCUMENT_TITLE, title.code, title.code_list_version)
		return { code: title.code, text: null, codeListVersion: version }
	}
}
