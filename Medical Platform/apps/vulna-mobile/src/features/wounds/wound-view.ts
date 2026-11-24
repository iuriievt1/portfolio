import type { BodyDiagramRegion, CodeListItem } from "../../api/code-lists"
import type { BodySite, Finding } from "../../api/findings"
import type { LocalizedNameOf } from "../../i18n/language-store"
import type { Texts } from "../../i18n/texts"
import { fillText } from "../../utils/fill-text"
import { formatDayMonth } from "../../utils/format-date"
import { inTextCase } from "../../utils/text-case"
import type { ClinicalSteps } from "../assessment/clinical-steps"
import { bodySiteDetailOf } from "../location/body-site-text"

// CAP-016-R19, E106, Vulna / Patient / Wound row
export function woundTitleOf(
	bodySite: BodySite | undefined,
	regions: readonly BodyDiagramRegion[],
	nameOf: LocalizedNameOf,
	texts: Texts,
): string {
	const region = regionNameOf(bodySite, regions, nameOf)
	if (bodySite === undefined || region === undefined) {
		return texts.wounds.unknownPlace
	}
	if (bodySite.laterality === null) {
		return region
	}
	return fillText(
		texts.wounds.place,
		{ region, side: texts.capture.location.side[bodySite.laterality] },
		texts.language,
	)
}

// CAP-016-R19, E106
export function woundPlaceLineOf(
	bodySite: BodySite | undefined,
	regions: readonly BodyDiagramRegion[],
	nameOf: LocalizedNameOf,
	texts: Texts,
): string | undefined {
	if (bodySite === undefined) {
		return undefined
	}
	const detail = bodySiteDetailOf(bodySite, texts)
	const region = regionNameOf(bodySite, regions, nameOf)
	return region === undefined ? detail : fillText(texts.wounds.detail.place, { region, detail }, texts.language)
}

// CAP-016-R18
export function regionNameOf(
	bodySite: BodySite | undefined,
	regions: readonly BodyDiagramRegion[],
	nameOf: LocalizedNameOf,
): string | undefined {
	const region = regions.find((candidate) => candidate.code === bodySite?.region_code)
	return region === undefined ? undefined : nameOf(region.names)
}

// CAP-017-R18
export function codeNameOf(
	items: readonly CodeListItem[],
	code: string | null | undefined,
	nameOf: LocalizedNameOf,
): string | undefined {
	const item = items.find((candidate) => candidate.code === code)
	return item === undefined ? undefined : nameOf(item.names)
}

// CAP-017-R02, CAP-017-R03, CAP-020-R19, CAP-017-R16
export function typeAndPhaseOf(
	type: string | undefined,
	phase: string | undefined,
	steps: ClinicalSteps,
	texts: Texts,
): string | undefined {
	const shownType = steps.woundType ? type : undefined
	const shownPhase = steps.healingPhase ? phase : undefined
	if (shownType === undefined || shownPhase === undefined) {
		return shownType ?? shownPhase
	}
	const phaseText = inTextCase(shownPhase, texts.textCase.phaseAfterType, texts.language)
	return fillText(texts.wounds.typeAndPhase, { type: shownType, phase: phaseText }, texts.language)
}

// CAP-020-R01, Vulna / Patient / Wound row
export function woundPeriodOf(finding: Finding, texts: Texts): string {
	const since = formatDayMonth(new Date(finding.created_at), texts.language)
	const lastMoment = finding.last_acquisition ?? finding.created_at
	const last = formatDayMonth(new Date(lastMoment), texts.language)
	return fillText(texts.wounds.period, { since, last }, texts.language)
}
