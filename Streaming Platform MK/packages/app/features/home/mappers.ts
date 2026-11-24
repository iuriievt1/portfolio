import type { HeroData, HeroItemData, RailData, RailItemData, RailVariant } from '@pkg/design-system'
import { clamp, formatDuration } from '@pkg/utils'
import type { Rail as DataRail, MediaItem, RailLayout } from '../../types/media'

// TODO: hotfix — all mock cards route to a single real DTC title for VOD testing.
// Remove once DATA_SOURCE=api with full DTC content is available.
// See packages/app/data/mock-provider.ts and apps/next/app/title/[id]/page.tsx.
export const DEMO_TITLE_HREF = '/title?id=667969ThirdParty31393234343934'

// ── Layout → Variant ────────────────────────────────────────────────

const LAYOUT_TO_VARIANT = {
	'backdrop-strip': 'backdrop',
	'poster-strip': 'poster',
	'continue-watching': 'continue',
	'live-strip': 'live',
	'featured-mini': 'backdrop',
	grid: 'backdrop',
	'schedule-strip': 'schedule',
	'highlights-strip': 'highlights',
	'multiview-strip': 'multiview',
	'sponsored-strip': 'sponsored',
} as const satisfies Record<RailLayout, RailVariant>

// ── Helpers ─────────────────────────────────────────────────────────

function imageForVariant(item: MediaItem, variant: RailVariant): string {
	if (variant === 'poster') {
		return item.poster?.src ?? item.backdrop?.src ?? ''
	}
	if (variant === 'character') {
		return item.poster?.src ?? item.backdrop?.src ?? ''
	}
	return item.backdrop?.src ?? item.poster?.src ?? ''
}

// ── Hero mappers ────────────────────────────────────────────────────

export function toHeroItem(item: MediaItem): HeroItemData {
	const tagBadge = item.badges?.find((b) => b.type === 'tag')

	return {
		id: item.id,
		title: item.title,
		imageUrl: item.backdrop?.src ?? item.poster?.src ?? '',
		href: item.href ?? `/title?id=${encodeURIComponent(item.id)}`,
		logoUrl: item.logo?.src,
		tagLabel: tagBadge?.label,
		isLive: item.kind === 'live',
		startTime: item.live ? 'Now' : undefined,
		year: item.year,
		duration: item.durationSec != null && item.durationSec > 0 ? formatDuration(item.durationSec) : undefined,
		synopsis: item.synopsis,
	}
}

export function toHeroData(items: MediaItem[], autoPlayMs?: number): HeroData {
	return {
		items: items.map(toHeroItem),
		autoPlayMs,
	}
}

// ── Rail mappers ────────────────────────────────────────────────────

export function toRailItem(item: MediaItem, variant: RailVariant): RailItemData {
	const base = {
		id: item.id,
		title: item.title,
		imageUrl: imageForVariant(item, variant),
		href: item.href ?? `/title?id=${encodeURIComponent(item.id)}`,
	}

	switch (variant) {
		case 'continue':
			return {
				...base,
				variant: 'continue',
				progress:
					item.progress && item.progress.durationSec > 0
						? clamp(item.progress.positionSec / item.progress.durationSec, 0, 1)
						: 0,
				duration: item.durationSec != null && item.durationSec > 0 ? formatDuration(item.durationSec) : undefined,
				episodeLabel: item.episodeLabel,
				description: item.synopsis,
			}

		case 'live':
			return {
				...base,
				variant: 'live',
				live: {
					channel: item.live?.channel ?? '',
					episode: item.live?.episode,
					show: item.title,
					progress: item.live?.progress ?? 0,
				},
			}

		case 'schedule':
			return {
				...base,
				variant: 'schedule',
				scheduledAt: item.sport?.timeLabel,
			}

		case 'highlights':
			return {
				...base,
				variant: 'highlights',
				metaLine: item.sport?.label
					? [item.sport.timeLabel, item.sport.label, item.sport.league].filter(Boolean).join(' · ')
					: undefined,
			}

		case 'multiview':
			return {
				...base,
				variant: 'multiview',
				multiviewCount: item.sport?.multiCamCount,
				metaLine: item.sport?.multiCamCount
					? `x${item.sport.multiCamCount} · ${item.sport.label ?? 'Multiple Games'}${item.sport.league ? ` · ${item.sport.league}` : ''}`
					: undefined,
			}

		case 'sponsored':
			return {
				...base,
				variant: 'sponsored',
				metaLine: item.sport?.label ? [item.sport.timeLabel, item.sport.label].filter(Boolean).join(' · ') : undefined,
			}

		case 'character':
			return { ...base, variant: 'character' }
		case 'poster':
			return { ...base, variant: 'poster' }
		case 'backdrop':
			return { ...base, variant: 'backdrop' }
		default: {
			const _exhaustive: never = variant
			return { ...base, variant: 'backdrop' }
		}
	}
}

export function toRailData(rail: DataRail): RailData {
	const variant = LAYOUT_TO_VARIANT[rail.layout] ?? 'backdrop'

	return {
		id: rail.id,
		title: rail.title,
		variant,
		items: rail.items.map((item) => toRailItem(item, variant)),
		viewAllHref: rail.ui?.seeAllHref,
		showCardTitle: variant === 'backdrop' || variant === 'poster',
	}
}
