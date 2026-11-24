import { type BodyView, LATERALITY, type Laterality, normalizedPointInRegion } from "@ansora/contracts"
import { CURRENT_BODY_DIAGRAM } from "../body-diagram/body-diagram"
import type { BodyDiagramRelease } from "../body-diagram/body-diagram-release"
import type { BodySite } from "../body-diagram/body-site"

// CAP-016-R04, CAP-016-R16

function drawnSiteOf(
	regionCode: string,
	view: BodyView,
	laterality: Laterality | null,
	release: BodyDiagramRelease,
): BodySite | undefined {
	const drawn = release.views[view]
	const point = drawn === undefined ? undefined : normalizedPointInRegion(view, drawn, regionCode, laterality)
	return point === undefined
		? undefined
		: { regionCode, laterality, view, ...point, bodyDiagramVersion: release.version }
}

export function bodySiteAt(
	regionCode: string,
	view: BodyView,
	laterality: Laterality | null,
	release: BodyDiagramRelease = CURRENT_BODY_DIAGRAM,
): BodySite {
	const site = drawnSiteOf(regionCode, view, laterality, release)
	if (site === undefined) {
		throw new Error(`no point of ${regionCode} on the ${laterality ?? "unpaired"} side in the ${view} view`)
	}
	return site
}

export function everyBodySiteOf(release: BodyDiagramRelease): BodySite[] {
	return Object.entries(release.views).flatMap(([view, drawn]) =>
		[...new Set((drawn?.areas ?? []).map((area) => area.regionCode))].flatMap((regionCode) => {
			const region = release.regions.find((candidate) => candidate.code === regionCode)
			const sides: readonly (Laterality | null)[] = region?.isPaired ? [LATERALITY.RIGHT, LATERALITY.LEFT] : [null]
			return sides.flatMap((side) => drawnSiteOf(regionCode, view as BodyView, side, release) ?? [])
		}),
	)
}
