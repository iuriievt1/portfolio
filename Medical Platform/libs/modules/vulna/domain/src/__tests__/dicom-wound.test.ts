import { BODY_VIEW, LATERALITY, type Laterality } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { BODY_DIAGRAM_RELEASES } from "../body-diagram/body-diagram"
import type { BodySite } from "../body-diagram/body-site"
import { DICOM_MAPPING_FAILURE, type DicomMappingFailure } from "../dicom/mapping-error"
import { dicomTextsIn } from "../dicom/texts"
import { uidOfUuid } from "../dicom/uid"
import { paddedLengthOf } from "../dicom/value-representation"
import { dicomWoundOf, type TrackedWound } from "../dicom/wound"

const DIAGRAM_VERSION = "2"
const FINDING_ID = "00000000-0000-4000-8000-000000000002"
const LOWER_CHEST_WALL = "699915001"
const FOREARM_FRONT = "70559009"
const FOREHEAD = "68698007"
const LONG_STRING_MAX_LENGTH = 64
const HIGHEST_WOUND_NUMBER = 999

function site(regionCode: string, laterality: Laterality | null, bodyDiagramVersion = DIAGRAM_VERSION): BodySite {
	return { regionCode, laterality, view: BODY_VIEW.ANTERIOR, x: 0.5, y: 0.5, bodyDiagramVersion }
}

function wound(woundNumber: number, bodySite: BodySite): TrackedWound {
	return { findingId: FINDING_ID, woundNumber, bodySite }
}

function refusal(failure: DicomMappingFailure) {
	return expect.objectContaining({ failure })
}

// integrace-dicom.md 5.3, 5.4
describe("DICOM attributes of a wound", () => {
	it("CAP-021-R15 names the wound by its number, its region and the side of the patient", () => {
		expect(dicomWoundOf(wound(2, site(LOWER_CHEST_WALL, LATERALITY.LEFT)), "cs")).toEqual({
			seriesDescription: "Rána 2 · Dolní část hrudní stěny (pod prsem) · levá strana",
			trackingId: "Rána 2",
			trackingUid: uidOfUuid(FINDING_ID),
		})
	})

	it("CAP-016-R11 leaves the side out at an unpaired region", () => {
		expect(dicomWoundOf(wound(1, site(FOREHEAD, null)), "cs").seriesDescription).toBe("Rána 1 · Čelo")
	})

	it("CAP-021-R26 writes the texts in the language of the instance whatever its letter case", () => {
		const chestWall = wound(2, site(LOWER_CHEST_WALL, LATERALITY.RIGHT))
		expect(dicomWoundOf(chestWall, "en").seriesDescription).toBe("Wound 2 · Skin of lower chest wall · right side")
		expect(dicomWoundOf(chestWall, "CS")).toEqual(dicomWoundOf(chestWall, "cs"))
	})

	it("CAP-021-S37 keeps the tracking UID of the wound in every study, whatever its number or place", () => {
		const first = dicomWoundOf(wound(1, site(FOREHEAD, null)), "cs")
		const later = dicomWoundOf(wound(7, site(LOWER_CHEST_WALL, LATERALITY.LEFT)), "en")
		expect(later.trackingUid).toBe(first.trackingUid)
	})

	it("CAP-017-R17 shortens only the region name when the description would exceed 64 characters", () => {
		const description = dicomWoundOf(wound(12, site(FOREARM_FRONT, LATERALITY.RIGHT)), "cs").seriesDescription
		expect(paddedLengthOf(description)).toBeLessThanOrEqual(LONG_STRING_MAX_LENGTH)
		expect(paddedLengthOf(description)).toBeGreaterThanOrEqual(LONG_STRING_MAX_LENGTH - 1)
		expect(description.startsWith("Rána 12 · Přední strana předloktí")).toBe(true)
		expect(description.endsWith("… · pravá strana")).toBe(true)
	})

	it("DICOM PS3.5 6.2 fits every region, side and language of every diagram into 64 characters", () => {
		for (const release of BODY_DIAGRAM_RELEASES) {
			for (const region of release.regions) {
				const sides = region.isPaired ? [LATERALITY.RIGHT, LATERALITY.LEFT] : [null]
				for (const language of Object.keys(region.names)) {
					const texts = dicomTextsIn(language)
					for (const side of sides) {
						const tracked = wound(HIGHEST_WOUND_NUMBER, site(region.code, side, release.version))
						const { seriesDescription, trackingId } = dicomWoundOf(tracked, language)
						const ending = side === null ? "" : ` · ${texts.shortSide[side]}`
						expect(paddedLengthOf(seriesDescription)).toBeLessThanOrEqual(LONG_STRING_MAX_LENGTH)
						expect(seriesDescription.startsWith(`${trackingId} · `)).toBe(true)
						expect(seriesDescription.endsWith(ending)).toBe(true)
					}
				}
			}
		}
	})

	it.each([
		["a region the diagram lacks", site("000000", null)],
		["an unknown version of the diagram", site(FOREHEAD, null, "9")],
	])("refuses %s (negative)", (_, bodySite) => {
		expect(() => dicomWoundOf(wound(1, bodySite), "cs")).toThrow(refusal(DICOM_MAPPING_FAILURE.UNKNOWN_BODY_SITE))
	})

	it.each(["de", "constructor"])(
		"CAP-021-R26 refuses the language %s it has no DICOM texts for (negative)",
		(language) => {
			expect(() => dicomWoundOf(wound(1, site(FOREHEAD, null)), language)).toThrow(
				refusal(DICOM_MAPPING_FAILURE.UNSUPPORTED_LANGUAGE),
			)
		},
	)
})
