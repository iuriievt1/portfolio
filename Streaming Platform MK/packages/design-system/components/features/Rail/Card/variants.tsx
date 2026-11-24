import { useCardAspect } from '../hooks/use-rail'
import type { RailItemData } from '../types'
import { CardBadges } from './Badges'
import { CardDateBadge } from './DateBadge'
import { CardDescription } from './Description'
import { CardEpisodeLabel } from './EpisodeLabel'
import { CardFrame } from './Frame'
import { CardGradient } from './Gradient'
import { CardImage } from './Image'
import { LiveCardContent } from './LiveCardContent'
import { CardMetadata } from './Metadata'

import { CardMetaLine } from './MetaLine'
import { CardMultiviewBadge } from './MultiviewBadge'
import { CardOuterMeta } from './OuterMeta'
import { CardOuterTitle } from './OuterTitle'
import { CardProgress } from './Progress'

// ── Standard variants — metadata overlaid inside the frame ──

export function PosterCardContent() {
	return (
		<>
			<CardFrame aspect={useCardAspect('poster')}>
				<CardImage />
				<CardBadges className='absolute top-2 left-2' />
			</CardFrame>
			<CardOuterMeta>
				<CardOuterTitle />
			</CardOuterMeta>
		</>
	)
}

export function CharacterCardContent() {
	return (
		<>
			<CardFrame aspect='square'>
				<CardImage />
				<CardBadges className='absolute top-2 left-2' />
			</CardFrame>
			<CardOuterMeta>
				<CardOuterTitle />
			</CardOuterMeta>
		</>
	)
}

export function BackdropCardContent() {
	return (
		<>
			<CardFrame aspect={useCardAspect('video')}>
				<CardImage />
				<CardDateBadge />
				<CardGradient position='bottom' />
				<CardMetadata>
					<CardBadges />
				</CardMetadata>
			</CardFrame>
			<CardOuterMeta>
				<CardOuterTitle />
			</CardOuterMeta>
		</>
	)
}

export function ContinueCardContent() {
	return (
		<>
			<CardFrame aspect='video'>
				<CardImage />
				<CardGradient position='bottom' />
				<CardMetadata className='space-y-1.5'>
					<CardProgress />
				</CardMetadata>
			</CardFrame>
			<CardOuterMeta>
				<CardOuterTitle />
				<CardEpisodeLabel />
				<CardDescription />
			</CardOuterMeta>
		</>
	)
}

// ── Sports variants — metadata renders BELOW the frame ──

export function ScheduleCardContent() {
	return (
		<>
			<CardFrame aspect={useCardAspect('video')}>
				<CardImage />
				<CardDateBadge />
			</CardFrame>
			<CardOuterMeta>
				<CardOuterTitle />
			</CardOuterMeta>
		</>
	)
}

export function HighlightsCardContent() {
	return (
		<>
			<CardFrame aspect={useCardAspect('video')}>
				<CardImage />
			</CardFrame>
			<CardOuterMeta>
				<CardMetaLine />
				<CardOuterTitle />
			</CardOuterMeta>
		</>
	)
}

export function MultiviewCardContent() {
	return (
		<>
			<CardFrame aspect={useCardAspect('video')}>
				<CardImage />
				<CardMultiviewBadge />
			</CardFrame>
			<CardOuterMeta>
				<CardMetaLine />
				<CardOuterTitle />
			</CardOuterMeta>
		</>
	)
}

export function SponsoredCardContent() {
	return (
		<>
			<CardFrame aspect={useCardAspect('video')}>
				<CardImage />
			</CardFrame>
			<CardOuterMeta>
				<CardMetaLine />
				<CardOuterTitle />
			</CardOuterMeta>
		</>
	)
}

export function CardContent({ item }: { item: RailItemData }) {
	switch (item.variant) {
		case 'poster':
			return <PosterCardContent />
		case 'character':
			return <CharacterCardContent />
		case 'continue':
			return <ContinueCardContent />
		case 'live':
			return <LiveCardContent />
		case 'schedule':
			return <ScheduleCardContent />
		case 'highlights':
			return <HighlightsCardContent />
		case 'multiview':
			return <MultiviewCardContent />
		case 'sponsored':
			return <SponsoredCardContent />
		case 'backdrop':
			return <BackdropCardContent />
		default: {
			const _exhaustive: never = item
			return <BackdropCardContent />
		}
	}
}
