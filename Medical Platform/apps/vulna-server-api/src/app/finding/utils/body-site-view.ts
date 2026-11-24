import type { BodySite } from "@ansora/vulna-domain"
import type { BodySiteColumns, BodySiteFields, BodySiteView } from "../types/finding.types"

// CAP-016-R03, CAP-016-R04
export function bodySiteOfRow(row: BodySiteFields): BodySite {
	return {
		regionCode: row.region_code,
		laterality: row.laterality,
		view: row.view,
		x: row.x,
		y: row.y,
		bodyDiagramVersion: row.body_diagram_version,
	}
}

export function bodySiteOfView(view: BodySiteView): BodySite {
	return {
		regionCode: view.region_code,
		laterality: view.laterality,
		view: view.view,
		x: view.x,
		y: view.y,
		bodyDiagramVersion: view.body_diagram_version,
	}
}

// clinical-workflow.yaml BodySite
export function bodySiteViewOfRow(row: BodySiteFields): BodySiteView {
	return {
		region_code: row.region_code,
		laterality: row.laterality,
		view: row.view,
		x: row.x,
		y: row.y,
		body_diagram_version: row.body_diagram_version,
	}
}

// ADR-054 bod 2, CAP-016-R16
export function bodySiteColumnsOf(site: BodySite | undefined): BodySiteColumns {
	return {
		region_code: site?.regionCode ?? null,
		laterality: site?.laterality ?? null,
		view: site?.view ?? null,
		x: site?.x ?? null,
		y: site?.y ?? null,
		body_diagram_version: site?.bodyDiagramVersion ?? null,
	}
}

// CAP-016-R17
export function isSameBodySite(first: BodySite, second: BodySite): boolean {
	return (
		first.regionCode === second.regionCode &&
		first.laterality === second.laterality &&
		first.view === second.view &&
		first.x === second.x &&
		first.y === second.y &&
		first.bodyDiagramVersion === second.bodyDiagramVersion
	)
}
