import { localizedNameOf } from "@ansora/contracts"
import type { BodyDiagramRelease } from "@ansora/vulna-domain"
import type { NameLanguages } from "../../localization/types/localization.types"
import { BACKGROUND_SEGMENT, BODY_DIAGRAMS_PATH } from "../constants/code-list.constants"
import type { BodyDiagramView } from "../types/code-list.types"

// clinical-workflow.yaml CodeListSet.body_diagram.background_url
export function backgroundUrl(version: string): string {
	return `/${BODY_DIAGRAMS_PATH}/${encodeURIComponent(version)}/${BACKGROUND_SEGMENT}`
}

// CAP-016-R07, CAP-016-R18, CAP-016-R03
export function bodyDiagramView(release: BodyDiagramRelease, languages: NameLanguages): BodyDiagramView {
	return {
		version: release.version,
		background_url: backgroundUrl(release.version),
		regions: release.regions.map((region) => ({
			code: region.code,
			name: localizedNameOf(region.names, languages.response, languages.instanceDefault),
			names: { ...region.names },
			views: [...region.views],
			is_paired: region.isPaired,
		})),
	}
}

export function bodyDiagramWithoutRegions(release: BodyDiagramRelease): BodyDiagramView {
	return { version: release.version, background_url: backgroundUrl(release.version), regions: [] }
}
