import { codeListSetVersionText } from "@ansora/core-server"
import type { HistoryScanRecord } from "@ansora/vulna-domain"
import type { DocumentTitleFields, DocumentTitleView } from "../types/acquisition-file.types"

// clinical-workflow.yaml DocumentTitle, CAP-018-R15
export function documentTitleViewOf(fields: DocumentTitleFields | undefined): DocumentTitleView | undefined {
	if (fields === undefined) {
		return undefined
	}
	if (fields.title_code !== null && fields.title_code_list_version !== null) {
		return { code: fields.title_code, code_list_version: codeListSetVersionText(fields.title_code_list_version) }
	}
	if (fields.title_text !== null) {
		return { text: fields.title_text }
	}
	return undefined
}

// ADR-054 bod 2, CAP-018-R15, CAP-020-R03
export function withHistoryScanTitle<T extends DocumentTitleFields>(row: T, scan: HistoryScanRecord): T {
	if (scan.title.code !== undefined) {
		return { ...row, title_code: scan.title.code }
	}
	return { ...row, title_code: null, title_text: scan.title.text ?? null }
}
