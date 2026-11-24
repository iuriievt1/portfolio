import { CODE_LIST } from "@ansora/contracts"
import { codeListSetVersionText } from "@ansora/core-server"
import { type BodyDiagramRelease, bodyDiagramRelease } from "@ansora/vulna-domain"
import { Injectable } from "@nestjs/common"
import { DatabaseService } from "../../../libs/database/database.service"
import { LocalizationService } from "../../localization/localization.service"
import type { NameLanguages } from "../../localization/types/localization.types"
import { CodeListRepository } from "../repositories/code-list.repository"
import { CodeListSetRepository } from "../repositories/code-list-set.repository"
import type { CodeListAnswer, CodeListItemView, CodeListSetRow, StoredCodeListItem } from "../types/code-list.types"
import { bodyDiagramView, bodyDiagramWithoutRegions } from "../utils/body-diagram-view"
import { codeListItemView } from "../utils/code-list-item-view"

// CAP-017-R10, CAP-016-R07, ADR-039
@Injectable()
export class CodeListService {
	constructor(
		private readonly database: DatabaseService,
		private readonly codeLists: CodeListRepository,
		private readonly sets: CodeListSetRepository,
		private readonly localization: LocalizationService,
	) {}

	async codeListSet(knownVersion: string | undefined, acceptLanguage: string | undefined): Promise<CodeListAnswer> {
		const languages = await this.localization.nameLanguages(acceptLanguage)
		const set = await this.sets.current(this.database.sql)
		const release = this.releaseOf(set)
		const version = codeListSetVersionText(set.version)
		if (knownVersion === version) {
			return {
				set: {
					version,
					wound_types: [],
					healing_phases: [],
					document_titles: [],
					body_diagram: bodyDiagramWithoutRegions(release),
				},
				contentLanguage: languages.response,
			}
		}
		const items = await this.codeLists.items(this.database.sql, undefined)
		return {
			set: {
				version,
				wound_types: viewsOf(items, CODE_LIST.WOUND_TYPE, languages),
				healing_phases: viewsOf(items, CODE_LIST.HEALING_PHASE, languages),
				document_titles: viewsOf(items, CODE_LIST.DOCUMENT_TITLE, languages),
				body_diagram: bodyDiagramView(release, languages),
			},
			contentLanguage: languages.response,
		}
	}

	// CAP-016-R07
	private releaseOf(set: CodeListSetRow): BodyDiagramRelease {
		const release = bodyDiagramRelease(set.body_diagram_version)
		if (release === undefined) {
			throw new Error(
				`Code list set ${set.version} names body diagram ${set.body_diagram_version}, which this release does not carry`,
			)
		}
		return release
	}
}

function viewsOf(
	items: readonly StoredCodeListItem[],
	codeListCode: string,
	languages: NameLanguages,
): CodeListItemView[] {
	return items.filter((item) => item.codeListCode === codeListCode).map((item) => codeListItemView(item, languages))
}
