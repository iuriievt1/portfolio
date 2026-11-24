import {
	BODY_VIEW,
	type BodyView,
	bodyDiagramSvg,
	type DiagramPoint,
	isInsidePolygon,
	isOnSilhouette,
	LATERALITY,
	type Laterality,
	lateralityAt,
	type MobileContract,
	normalizedPoint,
	normalizedPointInRegion,
	readBodyDiagramSvg,
	regionCodeAt,
	siteOnDrawing,
	subpathsOf,
} from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import {
	BODY_DIAGRAM_RELEASES,
	BODY_SURFACE,
	type BodyDiagramRelease,
	bodyDiagramRegion,
	bodyDiagramRegionAt,
	bodyDiagramRelease,
	bodySurfaceAt,
	CURRENT_BODY_DIAGRAM,
	type ReleaseView,
} from "../body-diagram"
import { type BodySite, bodySiteProblemOf } from "../body-diagram/body-site"

const GOLDEN_DICOM_REGIONS = [
	["43067004", "69536005"],
	["79951008", "69536005"],
	["68698007", "69536005"],
	["362916000", "371398005"],
	["113179006", "69536005"],
	["36141000", "69536005"],
	["88089004", "69536005"],
	["23747009", "661005"],
	["1902009", "69536005"],
	["11584001", "45048000"],
	["5272005", "45048000"],
	["4658004", "45048000"],
	["76072005", "45048000"],
	["66288003", "816094009"],
	["244107007", "816094009"],
	["82038008", "76752008"],
	["699915001", "816094009"],
	["76261009", "816094009"],
	["30598005", "818981001"],
	["699935000", "818981001"],
	["315003", "818981001"],
	["699914002", "818981001"],
	["367578008", "818981001"],
	["39687006", "816092008"],
	["60944009", "816092008"],
	["48014002", "816092008"],
	["45980000", "79601000"],
	["244111001", "816094009"],
	["113182001", "63337009"],
	["51027004", "54735007"],
	["22180002", "816092008"],
	["699903000", "816092008"],
	["450693000", "29836001"],
	["59112000", "53505006"],
	["45981001", "40983000"],
	["72939005", "40983000"],
	["17957002", "16953009"],
	["181536004", "16953009"],
	["70559009", "14975008"],
	["41550009", "14975008"],
	["70887009", "85562004"],
	["281642007", "85562004"],
	["244169007", "7569003"],
	["61248009", "68367000"],
	["4578000", "68367000"],
	["181553006", "72696002"],
	["84507004", "72696002"],
	["25763004", "30021000"],
	["47224004", "30021000"],
	["419975006", "70258002"],
	["84607009", "56459004"],
	["60496002", "56459004"],
	["52034004", "29707007"],
]

const SPEC_TABLE = [
	["43067004", ["anterior", "posterior"], false],
	["79951008", ["posterior"], false],
	["68698007", ["anterior"], false],
	["362916000", ["anterior"], true],
	["113179006", ["anterior"], false],
	["36141000", ["anterior"], true],
	["88089004", ["anterior"], false],
	["23747009", ["anterior"], false],
	["1902009", ["anterior", "posterior"], true],
	["11584001", ["anterior"], false],
	["5272005", ["anterior", "posterior"], true],
	["4658004", ["posterior"], false],
	["76072005", ["anterior"], true],
	["66288003", ["anterior"], true],
	["244107007", ["anterior"], false],
	["82038008", ["anterior"], true],
	["699915001", ["anterior"], true],
	["76261009", ["anterior", "posterior"], true],
	["30598005", ["anterior"], false],
	["699935000", ["anterior"], true],
	["315003", ["anterior"], false],
	["699914002", ["anterior"], true],
	["367578008", ["anterior"], false],
	["39687006", ["anterior"], true],
	["60944009", ["anterior"], false],
	["48014002", ["anterior", "posterior"], false],
	["45980000", ["posterior"], true],
	["244111001", ["posterior"], false],
	["113182001", ["posterior"], false],
	["51027004", ["posterior"], false],
	["22180002", ["posterior"], true],
	["699903000", ["posterior"], true],
	["450693000", ["anterior", "posterior"], true],
	["59112000", ["posterior"], false],
	["45981001", ["anterior"], true],
	["72939005", ["posterior"], true],
	["17957002", ["anterior"], true],
	["181536004", ["posterior"], true],
	["70559009", ["anterior"], true],
	["41550009", ["posterior"], true],
	["70887009", ["anterior"], true],
	["281642007", ["posterior"], true],
	["244169007", ["anterior", "posterior"], true],
	["61248009", ["anterior"], true],
	["4578000", ["posterior"], true],
	["181553006", ["anterior"], true],
	["84507004", ["posterior"], true],
	["25763004", ["anterior"], true],
	["47224004", ["posterior"], true],
	["419975006", ["anterior", "posterior"], true],
	["84607009", ["posterior"], true],
	["60496002", ["anterior", "posterior"], true],
	["52034004", ["anterior", "posterior"], true],
] as const

// docs/spec/schema-postavy.md 3
const EVERY_TOUCH_TIMEOUT_MILLISECONDS = 30_000
const SOLE = new Set<string>(["60496002", "52034004"])
const HEEL = "84607009"
const ANKLE = "419975006"
const GRID_STEP = 2
const HALVED_VIEWS: ReadonlySet<BodyView> = new Set([
	BODY_VIEW.ANTERIOR,
	BODY_VIEW.POSTERIOR,
	BODY_VIEW.PLANTAR,
	BODY_VIEW.DORSAL,
])

function drawnViewsOf(release: BodyDiagramRelease): (readonly [BodyView, ReleaseView])[] {
	return Object.values(BODY_VIEW).flatMap((view) => {
		const drawn = release.views[view]
		return drawn === undefined ? [] : [[view, drawn] as const]
	})
}

function gridOnSilhouette(view: ReleaseView): DiagramPoint[] {
	const points: DiagramPoint[] = []
	for (let y = GRID_STEP / 2; y < view.frame.height; y += GRID_STEP) {
		for (let x = GRID_STEP / 2; x < view.frame.width; x += GRID_STEP) {
			if (isOnSilhouette(view, { x, y })) {
				points.push({ x, y })
			}
		}
	}
	return points
}

describe.each(BODY_DIAGRAM_RELEASES.map((release) => [release.version, release] as const))(
	"body diagram release %s",
	(_, release) => {
		it("CAP-016-R01 carries 53 regions, 35 of them paired, each code once", () => {
			const codes = release.regions.map((region) => region.code)
			expect(new Set(codes).size).toBe(53)
			expect(release.regions.filter((region) => region.isPaired)).toHaveLength(35)
		})

		it("CAP-016-R18 names every region in Czech and English", () => {
			for (const region of release.regions) {
				expect(region.names.cs, region.code).toMatch(/\S/)
				expect(region.names.en, region.code).toMatch(/\S/)
			}
		})

		it("CAP-016-S04 maps every region to the DICOM code of the golden table", () => {
			expect(release.regions.map((region) => [region.code, region.dicomRegion.code])).toEqual(GOLDEN_DICOM_REGIONS)
		})

		it("draws every region in exactly the views it lists", () => {
			for (const [view, drawn] of drawnViewsOf(release)) {
				const areas = new Set(drawn.areas.map((area) => area.regionCode))
				const listed = release.regions.filter((region) => region.views.includes(view)).map((region) => region.code)
				expect([...areas].sort(), view).toEqual([...listed].sort())
			}
			for (const region of release.regions) {
				expect(
					region.views.every((view) => release.views[view] !== undefined),
					region.code,
				).toBe(true)
			}
		})

		it("CAP-016-R15 gives every point of the silhouette exactly one region", () => {
			for (const [view, drawn] of drawnViewsOf(release)) {
				const regionCount = (point: DiagramPoint) =>
					new Set(drawn.areas.filter((area) => isInsidePolygon(area.points, point)).map((area) => area.regionCode)).size
				expect(
					gridOnSilhouette(drawn).filter((point) => regionCount(point) !== 1),
					view,
				).toEqual([])
			}
		})

		it("CAP-016-R16 keeps every paired area on one half of a view split down the middle", () => {
			for (const [view, drawn] of drawnViewsOf(release)) {
				if (!HALVED_VIEWS.has(view)) {
					continue
				}
				const middle = drawn.frame.width / 2
				for (const area of drawn.areas) {
					if (bodyDiagramRegion(release, area.regionCode)?.isPaired !== true) {
						continue
					}
					const isLeft = area.points.every((point) => point.x <= middle)
					const isRight = area.points.every((point) => point.x >= middle)
					expect(isLeft || isRight, `${view} ${area.regionCode}`).toBe(true)
				}
			}
		})

		it(
			"reads back to the same regions under every touch",
			() => {
				const background = readBodyDiagramSvg(bodyDiagramSvg(release))
				expect(background.version).toBe(release.version)
				for (const [view, drawn] of drawnViewsOf(release)) {
					const read = background.views[view]
					expect(read?.frame, view).toEqual(drawn.frame)
					const differs = (point: DiagramPoint) =>
						read === undefined || regionCodeAt(read, point) !== regionCodeAt(drawn, point)
					expect(gridOnSilhouette(drawn).filter(differs), view).toEqual([])
				}
			},
			EVERY_TOUCH_TIMEOUT_MILLISECONDS,
		)

		it("does not give the anatomic surface away to the app", () => {
			expect(bodyDiagramSvg(release)).not.toMatch(/surface|medial/)
		})

		it("CAP-016-R20 holds only SVG path data in every silhouette part", () => {
			for (const [, drawn] of drawnViewsOf(release)) {
				for (const part of drawn.silhouette) {
					expect(part.path).toMatch(/^M[\d\s.,eE+\-MmLlHhVvCcSsQqTtAaZz]+$/)
					expect(subpathsOf(part.path).length).toBeGreaterThan(0)
				}
			}
		})

		it("CAP-016-R08 is found by its version", () => {
			expect(bodyDiagramRelease(release.version)).toBe(release)
		})
	},
)

describe("body diagram release 1", () => {
	const release = BODY_DIAGRAM_RELEASES[0] as BodyDiagramRelease

	it("keeps the views and pairing of docs/spec/schema-postavy.md, without the sole the silhouette does not draw", () => {
		for (const [code, views, isPaired] of SPEC_TABLE) {
			const region = bodyDiagramRegion(release, code)
			const drawn = SOLE.has(code) ? views.filter((view) => view !== BODY_VIEW.POSTERIOR) : views
			expect(region?.views, code).toEqual(drawn)
			expect(region?.isPaired, code).toBe(isPaired)
		}
	})

	it("Q-146 gives the heel the plantar surface", () => {
		expect(bodyDiagramRegionAt(release, BODY_VIEW.POSTERIOR, { x: 75, y: 392 })?.code).toBe(HEEL)
		expect(bodySurfaceAt(release, BODY_VIEW.POSTERIOR, { x: 75, y: 392 })).toBe(BODY_SURFACE.PLANTAR)
	})
})

describe("body diagram release 2 after the SONIS figure", () => {
	const release = CURRENT_BODY_DIAGRAM
	const first = BODY_DIAGRAM_RELEASES[0] as BodyDiagramRelease

	it("is the current release", () => {
		expect(release.version).toBe("2")
	})

	it("draws the six SONIS views", () => {
		expect(drawnViewsOf(release).map(([view]) => view)).toEqual([
			BODY_VIEW.ANTERIOR,
			BODY_VIEW.POSTERIOR,
			BODY_VIEW.RIGHT_LATERAL,
			BODY_VIEW.LEFT_LATERAL,
			BODY_VIEW.PLANTAR,
			BODY_VIEW.DORSAL,
		])
	})

	it("keeps the regions of release 1 with their names, pairing and DICOM codes", () => {
		expect(release.regions.map(({ views: _, ...region }) => region)).toEqual(
			first.regions.map(({ views: _, ...region }) => region),
		)
	})

	it("keeps the front and back of docs/spec/schema-postavy.md and draws the sole in the plantar view", () => {
		for (const [code, views] of SPEC_TABLE) {
			const region = bodyDiagramRegion(release, code)
			const specViews: readonly string[] = views
			const isBack = specViews.includes(BODY_VIEW.POSTERIOR) && !SOLE.has(code)
			expect(region?.views.includes(BODY_VIEW.ANTERIOR), code).toBe(specViews.includes(BODY_VIEW.ANTERIOR))
			expect(region?.views.includes(BODY_VIEW.POSTERIOR), code).toBe(isBack)
		}
		for (const code of [...SOLE, HEEL]) {
			expect(bodyDiagramRegion(release, code)?.views, code).toContain(BODY_VIEW.PLANTAR)
		}
	})

	it("CAP-016-R20 gives each view its own anatomic surface, the inner and outer ankle aside", () => {
		const expected: Record<BodyView, string> = {
			[BODY_VIEW.ANTERIOR]: BODY_SURFACE.ANTERIOR,
			[BODY_VIEW.POSTERIOR]: BODY_SURFACE.POSTERIOR,
			[BODY_VIEW.RIGHT_LATERAL]: BODY_SURFACE.LATERAL,
			[BODY_VIEW.LEFT_LATERAL]: BODY_SURFACE.LATERAL,
			[BODY_VIEW.PLANTAR]: BODY_SURFACE.PLANTAR,
			[BODY_VIEW.DORSAL]: BODY_SURFACE.ANTERIOR,
		}
		for (const [view, drawn] of drawnViewsOf(release)) {
			for (const area of drawn.areas) {
				if (area.regionCode === ANKLE && (view === BODY_VIEW.ANTERIOR || view === BODY_VIEW.POSTERIOR)) {
					expect([BODY_SURFACE.MEDIAL, BODY_SURFACE.LATERAL], `${view} ${area.regionCode}`).toContain(area.surface)
					continue
				}
				expect(area.surface, `${view} ${area.regionCode}`).toBe(expected[view])
			}
		}
	})

	it("Q-146 gives the ankle the side of the ankle, medial towards the midline", () => {
		const anterior = [
			[{ x: 130, y: 649 }, BODY_SURFACE.LATERAL],
			[{ x: 141, y: 649 }, BODY_SURFACE.MEDIAL],
			[{ x: 187, y: 649 }, BODY_SURFACE.MEDIAL],
			[{ x: 196, y: 649 }, BODY_SURFACE.LATERAL],
		] as const
		for (const [point, surface] of anterior) {
			expect(bodyDiagramRegionAt(release, BODY_VIEW.ANTERIOR, point)?.code).toBe(ANKLE)
			expect(bodySurfaceAt(release, BODY_VIEW.ANTERIOR, point)).toBe(surface)
		}
	})

	it("CAP-016-R17, CAP-016-R08 shows every site of release 1 inside the same region, view and side of release 2", () => {
		const sites = first.regions.flatMap((region) =>
			region.views.flatMap((view) => {
				const drawn = first.views[view]
				const sides: readonly (Laterality | null)[] = region.isPaired ? [LATERALITY.RIGHT, LATERALITY.LEFT] : [null]
				return sides.flatMap((laterality) => {
					const point = drawn && normalizedPointInRegion(view, drawn, region.code, laterality)
					return point === undefined
						? []
						: [{ region_code: region.code, laterality, view, ...point, body_diagram_version: first.version }]
				})
			}),
		)

		expect(sites.length).toBeGreaterThan(first.regions.length)
		for (const site of sites) {
			const shown = siteOnDrawing(release, site)
			const label = `${site.region_code} ${site.view} ${site.laterality ?? "unpaired"}`
			expect(shown, label).toMatchObject({
				region_code: site.region_code,
				laterality: site.laterality,
				view: site.view,
				body_diagram_version: release.version,
			})
			expect(shown && bodySiteProblemOf(domainSiteOf(shown)), label).toBeUndefined()
		}
	})

	it("CAP-016-R08 shows no site of release 2 in a view release 1 does not draw", () => {
		const sole = { region_code: "60496002", laterality: LATERALITY.RIGHT, view: BODY_VIEW.PLANTAR, x: 0.3, y: 0.5 }
		const site = { ...sole, body_diagram_version: release.version }

		expect(bodySiteProblemOf(domainSiteOf(site))).toBeUndefined()
		expect(siteOnDrawing(first, site)).toBeUndefined()
	})

	it("CAP-016-S01 finds the unpaired sacral region on the posterior view", () => {
		const region = bodyDiagramRegionAt(release, BODY_VIEW.POSTERIOR, { x: 160, y: 334 })
		expect(region?.code).toBe("51027004")
		expect(region?.isPaired).toBe(false)
	})

	it("CAP-016-S02 finds no region outside the figures", () => {
		expect(bodyDiagramRegionAt(release, BODY_VIEW.ANTERIOR, { x: 5, y: 5 })).toBeUndefined()
		expect(bodyDiagramRegionAt(release, BODY_VIEW.PLANTAR, { x: 111, y: 210 })).toBeUndefined()
	})

	it("CAP-016-S07 finds the knee with the patient's right on the left half of the anterior view", () => {
		const point = { x: 130, y: 520 }
		expect(bodyDiagramRegionAt(release, BODY_VIEW.ANTERIOR, point)?.code).toBe("181553006")
		expect(lateralityAt(BODY_VIEW.ANTERIOR, normalizedOf(BODY_VIEW.ANTERIOR, point))).toBe(LATERALITY.RIGHT)
	})

	it("CAP-016-S08 finds the heel with the patient's right on the right half of the posterior view", () => {
		const point = { x: 192, y: 679 }
		expect(bodyDiagramRegionAt(release, BODY_VIEW.POSTERIOR, point)?.code).toBe(HEEL)
		expect(lateralityAt(BODY_VIEW.POSTERIOR, normalizedOf(BODY_VIEW.POSTERIOR, point))).toBe(LATERALITY.RIGHT)
	})

	it("CAP-016-S13 finds the thigh with the patient's left on the right half of the anterior view", () => {
		const point = { x: 197, y: 444 }
		expect(bodyDiagramRegionAt(release, BODY_VIEW.ANTERIOR, point)?.code).toBe("61248009")
		expect(lateralityAt(BODY_VIEW.ANTERIOR, normalizedOf(BODY_VIEW.ANTERIOR, point))).toBe(LATERALITY.LEFT)
	})

	it("CAP-016-S15 finds the sole of the right foot on the left half of the plantar view with the plantar surface", () => {
		const point = { x: 67.5, y: 115.5 }
		expect(bodyDiagramRegionAt(release, BODY_VIEW.PLANTAR, point)?.code).toBe("60496002")
		expect(bodySurfaceAt(release, BODY_VIEW.PLANTAR, point)).toBe(BODY_SURFACE.PLANTAR)
		expect(lateralityAt(BODY_VIEW.PLANTAR, normalizedOf(BODY_VIEW.PLANTAR, point))).toBe(LATERALITY.RIGHT)
	})

	it("finds the back of the left foot on the left half of the dorsal view", () => {
		const point = { x: 61.5, y: 132 }
		expect(bodyDiagramRegionAt(release, BODY_VIEW.DORSAL, point)?.code).toBe("60496002")
		expect(lateralityAt(BODY_VIEW.DORSAL, normalizedOf(BODY_VIEW.DORSAL, point))).toBe(LATERALITY.LEFT)
	})

	it("finds the hip of the right side on the right lateral view", () => {
		const point = { x: 45, y: 384 }
		expect(bodyDiagramRegionAt(release, BODY_VIEW.RIGHT_LATERAL, point)?.code).toBe("450693000")
		expect(lateralityAt(BODY_VIEW.RIGHT_LATERAL, normalizedOf(BODY_VIEW.RIGHT_LATERAL, point))).toBe(LATERALITY.RIGHT)
	})

	it("finds the buttock of the left side on the left lateral view", () => {
		const point = { x: 112, y: 354 }
		expect(bodyDiagramRegionAt(release, BODY_VIEW.LEFT_LATERAL, point)?.code).toBe("22180002")
		expect(lateralityAt(BODY_VIEW.LEFT_LATERAL, normalizedOf(BODY_VIEW.LEFT_LATERAL, point))).toBe(LATERALITY.LEFT)
	})

	function domainSiteOf(site: MobileContract.components["schemas"]["BodySite"]): BodySite {
		return {
			regionCode: site.region_code,
			laterality: site.laterality,
			view: site.view,
			x: site.x,
			y: site.y,
			bodyDiagramVersion: site.body_diagram_version,
		}
	}

	function normalizedOf(view: BodyView, point: DiagramPoint): DiagramPoint {
		const frame = release.views[view]?.frame
		if (frame === undefined) {
			throw new Error(`release 2 lacks the ${view} view`)
		}
		return normalizedPoint(frame, point)
	}
})
