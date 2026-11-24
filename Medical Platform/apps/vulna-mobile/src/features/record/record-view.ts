import { ACQUISITION_KIND, type AcquisitionKind } from "@ansora/contracts"
import type { CodeListSet } from "../../api/code-lists"
import type { AcquisitionDetail, AcquisitionDetailFile } from "../../api/record"
import type { LocalizedNameOf } from "../../i18n/language-store"
import type { Texts } from "../../i18n/texts"
import { fillText, numberText } from "../../utils/fill-text"
import { formatDate, formatTime } from "../../utils/format-date"
import type { ClinicalSteps } from "../assessment/clinical-steps"
import { seriesTitleOf } from "../capture/series-text"
import { documentTitleOf } from "../documents/document-view"
import { pageTitleOf } from "../scan/page-text"
import { codeNameOf, regionNameOf, typeAndPhaseOf, woundTitleOf } from "../wounds/wound-view"

// CAP-015-R33, CAP-018-R11
export function orderedFilesOf(detail: AcquisitionDetail): AcquisitionDetailFile[] {
	return [...detail.files].sort((left, right) => left.sequence - right.sequence)
}

// ADR-026
export function fileIdOf(file: AcquisitionDetailFile): string | undefined {
	return file.image_id ?? file.page_id ?? undefined
}

// E108, Figma 07 B.1, Figma 08 A.2
export function recordTitleOf(
	detail: AcquisitionDetail,
	codeLists: CodeListSet,
	nameOf: LocalizedNameOf,
	texts: Texts,
) {
	if (detail.kind === ACQUISITION_KIND.SCAN) {
		return texts.record.documentTitle
	}
	const place = woundTitleOf(detail.body_site, codeLists.body_diagram.regions, nameOf, texts)
	return fillText(
		texts.record.title,
		{ place, date: formatDate(new Date(detail.closed_at), texts.language) },
		texts.language,
	)
}

// CAP-018-R15, E108
export function recordDocumentNameOf(
	detail: AcquisitionDetail,
	codeLists: CodeListSet,
	nameOf: LocalizedNameOf,
	texts: Texts,
): string {
	return documentTitleOf(detail.document_title, codeLists.document_titles, nameOf, texts)
}

// E108
export function closedAtOf(detail: AcquisitionDetail, texts: Texts): string {
	return fillText(
		texts.record.closedAt,
		{ time: formatTime(new Date(detail.closed_at), texts.language) },
		texts.language,
	)
}

// CAP-016-R19, E108
export function recordRegionOf(detail: AcquisitionDetail, codeLists: CodeListSet, nameOf: LocalizedNameOf) {
	return regionNameOf(detail.body_site, codeLists.body_diagram.regions, nameOf)
}

// CAP-017-R02, CAP-017-R03, CAP-020-R19, CAP-017-R16
export function recordAssessmentOf(
	detail: AcquisitionDetail,
	codeLists: CodeListSet,
	nameOf: LocalizedNameOf,
	steps: ClinicalSteps,
	texts: Texts,
): string | undefined {
	return typeAndPhaseOf(
		codeNameOf(codeLists.wound_types, detail.wound_type_code, nameOf),
		codeNameOf(codeLists.healing_phases, detail.assessment?.healing_phase_code, nameOf),
		steps,
		texts,
	)
}

// CAP-015-R32, CAP-018-R11, E94
export function fileTitleOf(kind: AcquisitionKind, index: number, count: number, texts: Texts): string {
	return kind === ACQUISITION_KIND.SCAN ? pageTitleOf(index, count, texts) : seriesTitleOf(index, count, texts)
}

// CAP-018-R11, Vulna / Document / Page
export function pageCaptionOf(index: number, count: number, texts: Texts): string {
	const from = numberText(texts.capture.review.from, count)
	return fillText(texts.record.page, { index: index + 1, from, count }, texts.language)
}

// CAP-020-R07, CAP-020-R15, CAP-026-R02, E30, E124
export function isPastPreviewRetention(detail: AcquisitionDetail): boolean {
	return !detail.is_image_data_available && detail.files.every((file) => file.thumbnail_url === null)
}
