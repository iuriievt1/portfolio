import type { CodeListItem } from "../../api/code-lists"
import type { PatientDocumentItem } from "../../api/documents"
import type { Encounter } from "../../api/encounters"
import type { DocumentTitle } from "../../api/record"
import type { LocalizedNameOf } from "../../i18n/language-store"
import type { Texts } from "../../i18n/texts"
import { countText, fillText } from "../../utils/fill-text"
import { formatCalendarDate, formatMonth, formatTime } from "../../utils/format-date"
import { capitalizedOf, type Section, sectionsInOrder } from "../history/sections"
import { encounterMomentOf } from "../visit/visit-view"

// CAP-018-R15, CAP-017-R18
export function documentTitleOf(
	title: DocumentTitle | undefined,
	titles: readonly CodeListItem[],
	nameOf: LocalizedNameOf,
	texts: Texts,
): string {
	const custom = title?.text?.trim()
	if (custom !== undefined && custom !== "") {
		return custom
	}
	const item = titles.find((candidate) => candidate.code === title?.code)
	return item === undefined ? texts.documents.untitled : nameOf(item.names)
}

// CAP-014-R03, CAP-014-S13, E110
export function documentVisitOf(encounter: Encounter, texts: Texts): string {
	const language = texts.language
	const date = formatCalendarDate(encounter.date, language)
	const moment = encounterMomentOf(encounter)
	if (moment === undefined) {
		return fillText(texts.documents.visitWithoutTime, { date }, language)
	}
	return fillText(texts.documents.visit, { date, time: formatTime(new Date(moment), language) }, language)
}

// CAP-015-R28, E110
export function documentPagesOf(pageCount: number, texts: Texts): string {
	return countText(texts.files.scan, pageCount, texts.language)
}

// CAP-020-R18, E110
export function documentSectionsOf(
	items: readonly PatientDocumentItem[],
	language: string,
): Section<PatientDocumentItem>[] {
	const newestFirst = [...items].sort(
		(left, right) => new Date(right.closed_at).getTime() - new Date(left.closed_at).getTime(),
	)
	return sectionsInOrder(newestFirst, (item) =>
		capitalizedOf(formatMonth(new Date(item.closed_at), language), language),
	)
}

// CAP-020-R07, CAP-026-R02, E30, E124
export function hasImageData(document: PatientDocumentItem): boolean {
	return document.is_image_data_available || (document.cover_page_id !== null && document.cover_page_id !== undefined)
}
