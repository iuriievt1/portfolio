import { ACQUISITION_KIND } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import type { TimelineItem, TimelinePage, WoundTypeChange } from "../../../api/findings"
import {
	latestBodySiteOf,
	photoSessionsOf,
	shownImagesOf,
	TIMELINE_ENTRY,
	timelineEntriesOf,
	trackedSinceOf,
	woundHistoryOf,
} from "../timeline"

const THUMBNAIL = "/images/x/thumbnail"
const SHIN = {
	region_code: "shin",
	laterality: "R",
	view: "anterior",
	x: 0.4,
	y: 0.7,
	body_diagram_version: "1",
} as const

function photo(id: string, time: string, change: Partial<TimelineItem> = {}): TimelineItem {
	return {
		acquisition_id: id,
		time,
		kind: ACQUISITION_KIND.PHOTO,
		is_image_data_available: true,
		thumbnail_url: THUMBNAIL,
		images: [{ image_id: `${id}-image-1` }, { image_id: `${id}-image-2` }],
		body_site: SHIN,
		...change,
	}
}

const TYPE_CHANGE: WoundTypeChange = {
	changed_at: "2026-08-20T09:00:00Z",
	previous_wound_type_code: "traumatic",
	wound_type_code: "venous-ulcer",
}

const NEWEST = photo("12-9", "2026-09-12T07:10:00Z")
const OLDEST = photo("14-8", "2026-08-14T06:58:00Z")
const MIDDLE = photo("27-8", "2026-08-27T08:12:00Z")

function page(items: TimelineItem[], change: Omit<Partial<TimelinePage>, "items"> = {}): TimelinePage {
	return { items, source_unavailable: false, ...change }
}

const HISTORY = woundHistoryOf([
	page([NEWEST, MIDDLE], {
		wound_type_code: "venous-ulcer",
		wound_type_changes: [TYPE_CHANGE],
		next_cursor: "next",
	}),
	page([OLDEST], { wound_type_changes: [TYPE_CHANGE] }),
])

describe("woundHistoryOf", () => {
	it("CAP-020-R19 keeps one wound type for the whole history and every change once", () => {
		expect(HISTORY.woundTypeCode).toBe("venous-ulcer")
		expect(HISTORY.items).toHaveLength(3)
		expect(HISTORY.changes).toEqual([TYPE_CHANGE])
		expect(HISTORY.isSourceUnavailable).toBe(false)
	})

	it("CAP-020-R12 tells an unavailable source from a wound without history", () => {
		expect(woundHistoryOf([page([], { source_unavailable: true })]).isSourceUnavailable).toBe(true)
	})
})

describe("timelineEntriesOf", () => {
	it("CAP-020-S25 puts the wound type change where it happened, newest first", () => {
		const entries = timelineEntriesOf(HISTORY, { woundType: true, healingPhase: true })
		expect(entries.map((entry) => entry.kind)).toEqual([
			TIMELINE_ENTRY.PHOTO,
			TIMELINE_ENTRY.PHOTO,
			TIMELINE_ENTRY.TYPE_CHANGE,
			TIMELINE_ENTRY.PHOTO,
		])
		expect(entries.map((entry) => entry.key)).toEqual(["12-9", "27-8", "2026-08-20T09:00:00Z:venous-ulcer", "14-8"])
	})

	it("CAP-017-S16 leaves out the wound type changes when the instance switched the wound type off", () => {
		const entries = timelineEntriesOf(HISTORY, { woundType: false, healingPhase: false })
		expect(entries.map((entry) => entry.key)).toEqual(["12-9", "27-8", "14-8"])
	})
})

describe("wound summary", () => {
	it("CAP-020-R01 tracks the wound since its first closed photo record and counts the sessions", () => {
		expect(trackedSinceOf(HISTORY)).toBe(OLDEST.time)
		expect(photoSessionsOf(HISTORY)).toBe(3)
		expect(latestBodySiteOf(HISTORY)).toEqual(SHIN)
	})
})

describe("shownImagesOf", () => {
	it("CAP-020-R10 shows no picture when the thumbnail is gone and never falls back to the full image", () => {
		const expired = photo("expired", "2026-09-20T07:00:00Z", { thumbnail_url: null, is_image_data_available: false })
		expect(shownImagesOf(expired)).toEqual([])
	})
})
