import { ACQUISITION_KIND } from "@ansora/contracts"
import type { BodySite, TimelineItem, TimelinePage, WoundTypeChange } from "../../api/findings"
import type { ClinicalSteps } from "../assessment/clinical-steps"

export const TIMELINE_ENTRY = {
	PHOTO: "photo",
	TYPE_CHANGE: "type_change",
} as const

type TimelineEntry =
	| { kind: typeof TIMELINE_ENTRY.PHOTO; key: string; time: string; item: TimelineItem }
	| { kind: typeof TIMELINE_ENTRY.TYPE_CHANGE; key: string; time: string; change: WoundTypeChange }

export interface WoundHistory {
	items: readonly TimelineItem[]
	woundTypeCode: string | undefined
	woundTypeCodeListVersion: string | undefined
	changes: readonly WoundTypeChange[]
	isSourceUnavailable: boolean
}

// CAP-020-R02, CAP-020-R12, CAP-020-R19
export function woundHistoryOf(pages: readonly TimelinePage[]): WoundHistory {
	const [first] = pages
	const changes = new Map<string, WoundTypeChange>()
	for (const change of pages.flatMap((page) => page.wound_type_changes ?? [])) {
		changes.set(typeChangeKeyOf(change), change)
	}
	return {
		items: pages.flatMap((page) => page.items ?? []),
		woundTypeCode: first?.wound_type_code ?? undefined,
		woundTypeCodeListVersion: first?.wound_type_code_list_version ?? undefined,
		changes: [...changes.values()],
		isSourceUnavailable: pages.some((page) => page.source_unavailable),
	}
}

// CAP-020-R19, CAP-020-R21, CAP-020-S25, CAP-017-R16, E122
export function timelineEntriesOf(history: WoundHistory, steps: ClinicalSteps): TimelineEntry[] {
	const photos: TimelineEntry[] = history.items.map((item) => ({
		kind: TIMELINE_ENTRY.PHOTO,
		key: item.acquisition_id,
		time: item.time,
		item,
	}))
	const shownChanges = steps.woundType ? history.changes : []
	const changes: TimelineEntry[] = shownChanges.map((change) => ({
		kind: TIMELINE_ENTRY.TYPE_CHANGE,
		key: typeChangeKeyOf(change),
		time: change.changed_at,
		change,
	}))
	return [...photos, ...changes].sort((left, right) => momentOf(right.time) - momentOf(left.time))
}

// CAP-020-R01
export function trackedSinceOf(history: WoundHistory): string | undefined {
	return oldestFirst(history.items)[0]?.time
}

// CAP-020-R01
export function photoSessionsOf(history: WoundHistory): number {
	return photoItemsOf(history.items).length
}

// CAP-016-R17, CAP-020-R20
export function latestBodySiteOf(history: WoundHistory): BodySite | undefined {
	return newestFirst(history.items).find((item) => item.body_site !== undefined)?.body_site
}

// ADR-026, CAP-020-R10
export function shownImagesOf(item: TimelineItem): string[] {
	if (item.thumbnail_url === null || item.thumbnail_url === undefined) {
		return []
	}
	return (item.images ?? []).map((image) => image.image_id)
}

function photoItemsOf(items: readonly TimelineItem[]): TimelineItem[] {
	return items.filter((item) => item.kind === ACQUISITION_KIND.PHOTO)
}

function newestFirst(items: readonly TimelineItem[]): TimelineItem[] {
	return [...items].sort((left, right) => momentOf(right.time) - momentOf(left.time))
}

function oldestFirst(items: readonly TimelineItem[]): TimelineItem[] {
	return [...items].sort((left, right) => momentOf(left.time) - momentOf(right.time))
}

function momentOf(time: string): number {
	return new Date(time).getTime()
}

function typeChangeKeyOf(change: WoundTypeChange): string {
	return `${change.changed_at}:${change.wound_type_code}`
}
