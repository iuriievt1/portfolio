import type { BodyDiagramRegion } from "../../api/code-lists"
import type { BodySite } from "../../api/findings"
import type { LocalizedNameOf } from "../../i18n/language-store"
import type { Texts } from "../../i18n/texts"
import { fillText } from "../../utils/fill-text"

export interface WoundPlace {
	region: string | undefined
	detail: string
}

// CAP-016-R19, CAP-016-R11, CAP-016-S13
export function bodySiteDetailOf(bodySite: BodySite, texts: Texts): string {
	const location = texts.capture.location
	const view = location.view[bodySite.view]
	if (bodySite.laterality === null) {
		return fillText(location.detailUnpaired, { view }, texts.language)
	}
	return fillText(location.detail, { side: location.side[bodySite.laterality], view }, texts.language)
}

// CAP-016-R18, CAP-016-R19, CAP-016-S12
export function woundPlaceOf(
	bodySite: BodySite,
	regions: readonly BodyDiagramRegion[],
	nameOf: LocalizedNameOf,
	texts: Texts,
): WoundPlace {
	const region = regions.find((candidate) => candidate.code === bodySite.region_code)
	return {
		region: region === undefined ? undefined : nameOf(region.names),
		detail: bodySiteDetailOf(bodySite, texts),
	}
}
