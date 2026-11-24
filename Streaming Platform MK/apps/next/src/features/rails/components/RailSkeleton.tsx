import type { RailLayout } from '@pkg/app/types/media'
import type { CardVariant } from '@pkg/design-system/tokens/rail'
import { buildRailSkeletonCSS, getMaxSkeletonCards } from '@pkg/design-system/tokens/rail-sizing'

// ── Layout mappings ─────────────────────────────────────────────

const LAYOUT_TO_VARIANT: Record<RailLayout, CardVariant> = {
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
}

const LAYOUT_TO_ASPECT: Record<RailLayout, string> = {
	'backdrop-strip': 'aspect-video',
	'poster-strip': 'aspect-[2/3]',
	'continue-watching': 'aspect-video',
	'featured-mini': 'aspect-video',
	'live-strip': 'aspect-video',
	grid: 'aspect-video',
	'schedule-strip': 'aspect-video',
	'highlights-strip': 'aspect-video',
	'multiview-strip': 'aspect-video',
	'sponsored-strip': 'aspect-video',
}

// ── Component ───────────────────────────────────────────────────

const SHIMMER = 'absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/[0.14] to-transparent'

export function RailSkeleton({ layout = 'backdrop-strip' }: { layout?: RailLayout }) {
	const variant = LAYOUT_TO_VARIANT[layout]
	const aspect = LAYOUT_TO_ASPECT[layout]
	const uid = `skel-${variant}`
	const selector = `[data-skel="${uid}"]`
	const maxCards = getMaxSkeletonCards(variant)

	return (
		<section className='space-y-3'>
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: static CSS from trusted token values */}
			<style dangerouslySetInnerHTML={{ __html: buildRailSkeletonCSS(variant, selector) }} />

			<div className='relative h-6 w-40 overflow-hidden rounded bg-white/[0.08]'>
				<div className={SHIMMER} />
			</div>

			<div data-skel={uid} className='flex overflow-hidden'>
				{Array.from({ length: maxCards }, (_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
					<div key={i} className={`${aspect} relative shrink-0 overflow-hidden rounded-md bg-surface`}>
						<div className={SHIMMER} />
					</div>
				))}
			</div>
		</section>
	)
}
